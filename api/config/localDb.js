const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dbFile = path.join(dataDir, 'local_db.json');

// Pastikan direktori data ada
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inisialisasi file database lokal jika belum ada
function getDb() {
  if (!fs.existsSync(dbFile)) {
    const initialData = {
      tokens: [
        {
          id: 1,
          code: 'RBK-DEMO',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          is_active: true
        }
      ],
      absensi: []
    };
    fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(dbFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { tokens: [], absensi: [] };
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[LOCAL DB ERROR] Gagal menyimpan data:', err);
  }
}

/**
 * Driver simulasi Query PostgreSQL untuk pengujian lokal tanpa database cloud
 */
async function localQuery(text, params = []) {
  const db = getDb();
  const trimmed = text.trim();

  // 1. CREATE TABLE / CREATE INDEX -> No-Op
  if (trimmed.toUpperCase().startsWith('CREATE TABLE') || trimmed.toUpperCase().startsWith('CREATE INDEX')) {
    return { rows: [], rowCount: 0 };
  }

  // 2. SELECT token aktif (Admin GET /api/admin/token/active)
  if (trimmed.includes('FROM tokens') && trimmed.includes('is_active = TRUE AND expires_at > CURRENT_TIMESTAMP')) {
    const now = new Date();
    const active = db.tokens
      .filter(t => t.is_active && new Date(t.expires_at) > now)
      .sort((a, b) => b.id - a.id);

    if (active.length === 0) {
      return { rows: [], rowCount: 0 };
    }

    const t = active[0];
    const secondsLeft = Math.max(0, Math.floor((new Date(t.expires_at).getTime() - now.getTime()) / 1000));
    return {
      rows: [{
        ...t,
        seconds_left: secondsLeft
      }],
      rowCount: 1
    };
  }

  // 3. SELECT token by code (Absensi check token)
  if (trimmed.includes('FROM tokens') && trimmed.includes('UPPER(code) = $1')) {
    const code = (params[0] || '').toUpperCase();
    const found = db.tokens.find(t => t.code.toUpperCase() === code);
    return {
      rows: found ? [found] : [],
      rowCount: found ? 1 : 0
    };
  }

  // 4. UPDATE tokens SET is_active = FALSE (Deactivate old tokens)
  if (trimmed.startsWith('UPDATE tokens SET is_active = FALSE')) {
    db.tokens.forEach(t => { t.is_active = false; });
    saveDb(db);
    return { rows: [], rowCount: db.tokens.length };
  }

  // 5. INSERT INTO tokens (Generate token baru)
  if (trimmed.startsWith('INSERT INTO tokens')) {
    const newId = db.tokens.length > 0 ? Math.max(...db.tokens.map(t => t.id)) + 1 : 1;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const newEntry = {
      id: newId,
      code: params[0],
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true
    };
    db.tokens.push(newEntry);
    saveDb(db);
    return {
      rows: [newEntry],
      rowCount: 1
    };
  }

  // 6. SELECT duplikat absensi (Nama + Kelas + Token)
  if (trimmed.includes('FROM absensi') && trimmed.includes('LOWER(TRIM(nama)) = LOWER(TRIM($1))')) {
    const nama = (params[0] || '').trim().toLowerCase();
    const kelas = params[1];
    const token = (params[2] || '').trim().toUpperCase();

    const dup = db.absensi.find(a =>
      a.nama.trim().toLowerCase() === nama &&
      a.kelas === kelas &&
      a.token_used.toUpperCase() === token
    );

    return {
      rows: dup ? [{ id: dup.id, created_at: dup.created_at }] : [],
      rowCount: dup ? 1 : 0
    };
  }

  // 6b. SELECT cek kunci perangkat (device_id + token)
  if (trimmed.includes('FROM absensi') && trimmed.includes('device_id = $1') && trimmed.includes('token_used = $2')) {
    const devId = params[0] || '';
    const token = (params[1] || '').trim().toUpperCase();

    const devMatch = db.absensi.find(a =>
      a.device_id && a.device_id === devId &&
      a.token_used && a.token_used.toUpperCase() === token
    );

    return {
      rows: devMatch ? [{ id: devMatch.id, nama: devMatch.nama, kelas: devMatch.kelas, created_at: devMatch.created_at }] : [],
      rowCount: devMatch ? 1 : 0
    };
  }

  // 7. INSERT INTO absensi
  if (trimmed.startsWith('INSERT INTO absensi')) {
    const newId = db.absensi.length > 0 ? Math.max(...db.absensi.map(a => a.id)) + 1 : 1;
    const newRecord = {
      id: newId,
      nama: params[0],
      kelas: params[1],
      token_used: params[2],
      user_lat: params[3],
      user_lon: params[4],
      distance_meters: params[5],
      device_id: params[6] || null,
      created_at: new Date().toISOString()
    };
    db.absensi.push(newRecord);
    saveDb(db);
    return {
      rows: [newRecord],
      rowCount: 1
    };
  }

  // 8. Hitung statistik absensi (COUNT total_all, total_today, total_kelas_aktif)
  if (trimmed.includes('COUNT(*) AS total_all')) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = db.absensi.filter(a => (a.created_at || '').startsWith(todayStr)).length;
    const distinctClasses = new Set(db.absensi.map(a => a.kelas)).size;
    return {
      rows: [{
        total_all: db.absensi.length,
        total_today: todayCount,
        total_kelas_aktif: distinctClasses
      }],
      rowCount: 1
    };
  }

  // 9. SELECT absensi rekap & export
  if (trimmed.includes('FROM absensi')) {
    let list = [...db.absensi];

    // Filter search nama jika ada
    if (trimmed.includes('LOWER(nama) LIKE LOWER($')) {
      const searchVal = (params[0] || '').replace(/%/g, '').toLowerCase();
      list = list.filter(a => a.nama.toLowerCase().includes(searchVal));
    }

    // Filter kelas jika ada
    if (trimmed.includes('kelas = $')) {
      const classParam = params.find(p => typeof p === 'string' && (p.startsWith('X-') || p.startsWith('XI-')));
      if (classParam && classParam !== 'ALL') {
        list = list.filter(a => a.kelas === classParam);
      }
    }

    // Urutan: default DESC untuk live feed, ASC untuk export
    if (trimmed.includes('ORDER BY id ASC')) {
      list.sort((a, b) => a.id - b.id);
    } else {
      list.sort((a, b) => b.id - a.id);
    }

    return {
      rows: list,
      rowCount: list.length
    };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = {
  localQuery,
  dbFile
};
