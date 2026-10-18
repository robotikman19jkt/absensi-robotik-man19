const { Pool } = require('pg');
const { localQuery, dbFile } = require('./localDb');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const isPlaceholder = !connectionString || 
  connectionString.includes('password_kamu') || 
  connectionString.includes('ref_supabase') || 
  connectionString.trim() === '';

let pool = null;
let useLocalDb = false;

if (isPlaceholder) {
  useLocalDb = true;
  console.log('----------------------------------------------------');
  console.log('⚡ [DB MODE] MODE LOKAL / DEVELOPMENT AKTIF');
  console.log(`📁 Menggunakan database lokal JSON: ${dbFile}`);
  console.log('💡 Anda dapat langsung mencoba seluruh fitur web tanpa perlu mendaftar Supabase/Neon dulu!');
  console.log('----------------------------------------------------');
} else {
  // Konfigurasi koneksi Pool PostgreSQL asli
  pool = new Pool({
    connectionString,
    ssl: !connectionString.includes('localhost') ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[DB POSTGRES ERROR]:', err);
  });
}

// Inisialisasi tabel untuk PostgreSQL
let isInitialized = false;
async function ensureTablesExist() {
  if (useLocalDb || isInitialized || !pool) return;
  try {
    const initSql = `
      CREATE TABLE IF NOT EXISTS tokens (
          id SERIAL PRIMARY KEY,
          code VARCHAR(30) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS absensi (
          id SERIAL PRIMARY KEY,
          nama VARCHAR(150) NOT NULL,
          kelas VARCHAR(20) NOT NULL,
          token_used VARCHAR(30) NOT NULL,
          user_lat NUMERIC(10, 7) NOT NULL,
          user_lon NUMERIC(10, 7) NOT NULL,
          distance_meters NUMERIC(10, 2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_code ON tokens(code);
      CREATE INDEX IF NOT EXISTS idx_absensi_token_used ON absensi(token_used);
      CREATE INDEX IF NOT EXISTS idx_absensi_nama_kelas_token ON absensi(LOWER(TRIM(nama)), kelas, token_used);
    `;
    await pool.query(initSql);
    isInitialized = true;
    console.log('[DB SUCCESS] Tabel database PostgreSQL berhasil diverifikasi/dibuat.');
  } catch (err) {
    console.error('[DB INIT ERROR] Gagal inisialisasi tabel:', err.message);
  }
}

module.exports = {
  query: async (text, params) => {
    if (useLocalDb) {
      return localQuery(text, params);
    }
    await ensureTablesExist();
    return pool.query(text, params);
  },
  pool,
  ensureTablesExist
};
