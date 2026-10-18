const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { calculateDistanceMeters } = require('../utils/haversine');
const { formatWIB } = require('../utils/token');

// Koordinat resmi titik pusat MAN 19 Jakarta (Petukangan Utara, Pesanggrahan)
const DEFAULT_CENTER_LAT = -6.230700;
const DEFAULT_CENTER_LON = 106.747600;
const DEFAULT_MAX_RADIUS = 150; // 150 meter (toleransi aman untuk seluruh area gedung & lab robotik)

// Daftar kelas resmi yang diperbolehkan
const VALID_CLASSES = [
  'X-A', 'X-B', 'X-C', 'X-D', 'X-E', 'X-F', 'X-G', 'X-H',
  'XI-A', 'XI-B', 'XI-C', 'XI-D', 'XI-E', 'XI-F', 'XI-G', 'XI-H'
];

/**
 * POST /api/absensi
 * Endpoint pencatatan absensi siswa
 */
router.post('/', async (req, res) => {
  try {
    let { nama, kelas, token, user_lat, user_lon, device_id } = req.body;

    // 1. Validasi Keberadaan Input
    if (!nama || !kelas || !token || user_lat === undefined || user_lon === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Semua kolom formulir dan koordinat lokasi (GPS) wajib diisi!'
      });
    }

    nama = nama.trim();
    token = token.trim().toUpperCase();

    if (nama.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap minimal 3 karakter!'
      });
    }

    if (!VALID_CLASSES.includes(kelas)) {
      return res.status(400).json({
        success: false,
        message: `Pilihan kelas "${kelas}" tidak valid!`
      });
    }

    const lat = parseFloat(user_lat);
    const lon = parseFloat(user_lon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Koordinat lokasi GPS tidak valid. Pastikan izin GPS aktif di browser Anda!'
      });
    }

    // 2. Validasi Token & Masa Berlaku (30 Menit)
    const tokenQuery = `
      SELECT id, code, created_at, expires_at, is_active
      FROM tokens
      WHERE UPPER(code) = $1
      LIMIT 1
    `;
    const tokenResult = await db.query(tokenQuery, [token]);

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Kode token absensi salah atau tidak terdaftar!'
      });
    }

    const tokenData = tokenResult.rows[0];

    if (!tokenData.is_active) {
      return res.status(400).json({
        success: false,
        code: 'INACTIVE_TOKEN',
        message: 'Kode token absensi ini sudah dinonaktifkan oleh Admin.'
      });
    }

    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        code: 'EXPIRED_TOKEN',
        message: 'Kode token absensi telah kedaluwarsa! Sesi token hanya aktif selama 30 menit sejak dibuat.'
      });
    }

    // 3. Validasi Geofencing (Radius Max 100m dari MAN 19 Jakarta)
    const centerLat = parseFloat(process.env.MAN19_LAT || DEFAULT_CENTER_LAT);
    const centerLon = parseFloat(process.env.MAN19_LON || DEFAULT_CENTER_LON);
    const maxRadius = parseFloat(process.env.MAX_RADIUS_METERS || DEFAULT_MAX_RADIUS);

    const distanceMeters = calculateDistanceMeters(lat, lon, centerLat, centerLon);

    if (distanceMeters > maxRadius) {
      return res.status(400).json({
        success: false,
        code: 'OUT_OF_BOUNDS',
        distance: distanceMeters,
        maxRadius,
        message: `Absensi ditolak! Posisi Anda terdeteksi berjarak ${distanceMeters} meter dari MAN 19 Jakarta. Batas maksimal yang diizinkan adalah ${maxRadius} meter.`
      });
    }

    // 4. Validasi Pencegahan Absen Ganda (Nama + Kelas + Token Sama)
    const duplicateQuery = `
      SELECT id, created_at 
      FROM absensi 
      WHERE LOWER(TRIM(nama)) = LOWER(TRIM($1)) 
        AND kelas = $2 
        AND UPPER(token_used) = $3
      LIMIT 1
    `;
    const duplicateResult = await db.query(duplicateQuery, [nama, kelas, token]);

    if (duplicateResult.rows.length > 0) {
      const existingTime = formatWIB(duplicateResult.rows[0].created_at);
      return res.status(400).json({
        success: false,
        code: 'DUPLICATE_ENTRY',
        message: `Siswa "${nama}" (${kelas}) sudah melakukan absensi untuk sesi token ini pada ${existingTime}!`
      });
    }

    // 5. Validasi Kunci 1 Perangkat (Anti Titip Absen per Sesi Token)
    if (device_id && typeof device_id === 'string' && device_id.trim() !== '') {
      const cleanDeviceId = device_id.trim();
      const deviceCheckQuery = `
        SELECT id, nama, kelas, created_at
        FROM absensi
        WHERE device_id = $1 AND UPPER(token_used) = $2
        LIMIT 1
      `;
      const deviceResult = await db.query(deviceCheckQuery, [cleanDeviceId, token]);

      if (deviceResult.rows.length > 0) {
        const prev = deviceResult.rows[0];
        return res.status(400).json({
          success: false,
          code: 'DEVICE_LOCKED',
          message: `Perangkat (HP) ini sudah digunakan untuk absensi atas nama "${prev.nama}" (${prev.kelas}) pada sesi token ini! Dilarang mengabsenkan siswa lain (Anti Titip Absen).`
        });
      }
    }

    // 6. Simpan Data Absensi ke PostgreSQL
    const insertQuery = `
      INSERT INTO absensi (nama, kelas, token_used, user_lat, user_lon, distance_meters, device_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING id, nama, kelas, token_used, distance_meters, created_at
    `;
    const insertResult = await db.query(insertQuery, [
      nama,
      kelas,
      token,
      lat,
      lon,
      distanceMeters,
      device_id || null
    ]);

    const savedRecord = insertResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Absensi Robotik berhasil diverifikasi & dicatat!',
      data: {
        id: savedRecord.id,
        nama: savedRecord.nama,
        kelas: savedRecord.kelas,
        token_used: savedRecord.token_used,
        distance_meters: savedRecord.distance_meters,
        waktu_wib: formatWIB(savedRecord.created_at)
      }
    });

  } catch (error) {
    console.error('[API ABSENSI ERROR]:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem internal server. Silakan hubungi admin robotik.'
    });
  }
});

/**
 * GET /api/absensi/info
 * Cek koordinat target dan status sistem
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    organisasi: 'Ekstrakurikuler Robotik MAN 19 Jakarta',
    target: {
      latitude: parseFloat(process.env.MAN19_LAT || DEFAULT_CENTER_LAT),
      longitude: parseFloat(process.env.MAN19_LON || DEFAULT_CENTER_LON),
      max_radius_meters: parseFloat(process.env.MAX_RADIUS_METERS || DEFAULT_MAX_RADIUS)
    },
    valid_classes: VALID_CLASSES
  });
});

module.exports = router;
