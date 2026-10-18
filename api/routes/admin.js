const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { generateTokenCode, formatWIB } = require('../utils/token');

// Middleware otentikasi PIN Admin
const requireAdminAuth = (req, res, next) => {
  const configuredPin = process.env.ADMIN_PIN || 'ROBOTIK19';
  const providedPin = req.headers['x-admin-pin'] || req.query.pin || (req.body && req.body.pin);

  if (!providedPin || providedPin !== configuredPin) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak! PIN Admin salah atau tidak disertakan.'
    });
  }
  next();
};

/**
 * POST /api/admin/verify
 * Verifikasi PIN Admin untuk login frontend
 */
router.post('/verify', (req, res) => {
  const configuredPin = process.env.ADMIN_PIN || 'ROBOTIK19';
  const { pin } = req.body;

  if (pin === configuredPin) {
    return res.json({ success: true, message: 'Autentikasi admin berhasil!' });
  }
  return res.status(401).json({ success: false, message: 'PIN Admin yang Anda masukkan salah!' });
});

// Semua route di bawah ini dilindungi middleware PIN
router.use(requireAdminAuth);

/**
 * GET /api/admin/token/active
 * Cek token yang saat ini sedang aktif (dalam batas 30 menit)
 */
router.get('/token/active', async (req, res) => {
  try {
    const query = `
      SELECT id, code, created_at, expires_at, is_active,
             EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)) AS seconds_left
      FROM tokens
      WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
      ORDER BY id DESC
      LIMIT 1
    `;
    const result = await db.query(query);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        has_active_token: false,
        token: null
      });
    }

    const row = result.rows[0];
    const secondsLeft = Math.max(0, Math.floor(parseFloat(row.seconds_left)));

    return res.json({
      success: true,
      has_active_token: true,
      token: {
        id: row.id,
        code: row.code,
        created_at_wib: formatWIB(row.created_at),
        expires_at_wib: formatWIB(row.expires_at),
        expires_at_raw: row.expires_at,
        seconds_left: secondsLeft
      }
    });
  } catch (error) {
    console.error('[ADMIN GET ACTIVE TOKEN ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data token aktif.' });
  }
});

/**
 * POST /api/admin/token
 * Generate token baru dengan masa aktif tepat 30 menit
 */
router.post('/token', async (req, res) => {
  try {
    // 1. Nonaktifkan token lama yang masih aktif agar hanya ada 1 token aktif saat ini
    await db.query('UPDATE tokens SET is_active = FALSE WHERE is_active = TRUE');

    // 2. Generate kode baru
    const newCode = generateTokenCode('RBK', 4);

    // 3. Simpan ke database dengan batas waktu tepat 30 menit
    const insertQuery = `
      INSERT INTO tokens (code, created_at, expires_at, is_active)
      VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 minutes', TRUE)
      RETURNING id, code, created_at, expires_at, is_active
    `;
    const insertResult = await db.query(insertQuery, [newCode]);
    const row = insertResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Token absensi baru berhasil digenerate! Masa aktif 30 menit.',
      token: {
        id: row.id,
        code: row.code,
        created_at_wib: formatWIB(row.created_at),
        expires_at_wib: formatWIB(row.expires_at),
        expires_at_raw: row.expires_at,
        seconds_left: 30 * 60
      }
    });
  } catch (error) {
    console.error('[ADMIN GENERATE TOKEN ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Gagal men-generate token baru.' });
  }
});

/**
 * GET /api/admin/rekap
 * Live feed dan tabel rekap data absensi
 */
router.get('/rekap', async (req, res) => {
  try {
    const { search, kelas, limit = 200 } = req.query;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      conditions.push(`LOWER(nama) LIKE LOWER($${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (kelas && kelas.trim() !== '' && kelas !== 'ALL') {
      conditions.push(`kelas = $${paramIndex}`);
      params.push(kelas.trim());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Ambil daftar absensi
    const query = `
      SELECT id, nama, kelas, token_used, user_lat, user_lon, distance_meters, device_id, created_at
      FROM absensi
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${parseInt(limit, 10) || 200}
    `;
    const result = await db.query(query, params);

    // Hitung statistik ringkasan
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_all,
        COUNT(CASE WHEN DATE(created_at AT TIME ZONE 'Asia/Jakarta') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta') THEN 1 END) AS total_today,
        COUNT(DISTINCT kelas) AS total_kelas_aktif
      FROM absensi
    `;
    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0] || { total_all: 0, total_today: 0, total_kelas_aktif: 0 };

    const formattedData = result.rows.map(item => ({
      id: item.id,
      nama: item.nama,
      kelas: item.kelas,
      token_used: item.token_used,
      distance_meters: parseFloat(item.distance_meters),
      device_id: item.device_id || '-',
      user_lat: parseFloat(item.user_lat),
      user_lon: parseFloat(item.user_lon),
      created_at_wib: formatWIB(item.created_at),
      created_at_raw: item.created_at
    }));

    return res.json({
      success: true,
      stats: {
        total_all: parseInt(stats.total_all, 10),
        total_today: parseInt(stats.total_today, 10),
        total_kelas_aktif: parseInt(stats.total_kelas_aktif, 10)
      },
      data: formattedData
    });
  } catch (error) {
    console.error('[ADMIN GET REKAP ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil rekap data absensi.' });
  }
});

/**
 * GET /api/admin/export
 * Ekspor data rekap absensi ke format file CSV (kompatibel Excel dengan UTF-8 BOM)
 */
router.get('/export', async (req, res) => {
  try {
    const { kelas } = req.query;

    let query = `
      SELECT id, nama, kelas, token_used, distance_meters, device_id, created_at, user_lat, user_lon
      FROM absensi
    `;
    let params = [];

    if (kelas && kelas !== 'ALL') {
      query += ` WHERE kelas = $1`;
      params.push(kelas);
    }

    query += ` ORDER BY id ASC`;

    const result = await db.query(query, params);

    // Buat format CSV dengan pembatas koma atau titik koma yang rapi
    const headers = ['No', 'Nama Lengkap', 'Kelas', 'Waktu Absen (WIB)', 'Jarak dari MAN 19 (Meter)', 'Kode Token', 'ID Perangkat (Device Lock)', 'Latitude', 'Longitude'];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF'; // UTF-8 BOM agar aksen dan format terbaca rapi di Microsoft Excel Windows
    csvContent += headers.map(escapeCsv).join(';') + '\r\n';

    result.rows.forEach((row, index) => {
      const line = [
        index + 1,
        row.nama,
        row.kelas,
        formatWIB(row.created_at),
        `${parseFloat(row.distance_meters)} m`,
        row.token_used,
        row.device_id || '-',
        row.user_lat,
        row.user_lon
      ];
      csvContent += line.map(escapeCsv).join(';') + '\r\n';
    });

    const nowJakarta = new Date().toISOString().split('T')[0];
    const filename = `Rekap_Absensi_Robotik_MAN19_${nowJakarta}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[ADMIN EXPORT ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengekspor data absensi.' });
  }
});

module.exports = router;
