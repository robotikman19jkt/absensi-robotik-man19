-- ==============================================================
-- DATABASE SCHEMA: SISTEM ABSENSI ROBOTIK MAN 19 JAKARTA
-- Dialect: PostgreSQL (Supabase / Neon Compatible)
-- ==============================================================

-- 1. Buat Tabel Tokens
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index untuk mempercepat pencarian validasi kode token
CREATE INDEX IF NOT EXISTS idx_tokens_code ON tokens(code);
CREATE INDEX IF NOT EXISTS idx_tokens_active_expires ON tokens(is_active, expires_at);

-- 2. Buat Tabel Absensi
CREATE TABLE IF NOT EXISTS absensi (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    kelas VARCHAR(20) NOT NULL,
    token_used VARCHAR(30) NOT NULL,
    user_lat NUMERIC(10, 7) NOT NULL,
    user_lon NUMERIC(10, 7) NOT NULL,
    distance_meters NUMERIC(10, 2) NOT NULL,
    device_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index untuk pengecekan cepat duplikasi absen per token & per device
CREATE INDEX IF NOT EXISTS idx_absensi_token_used ON absensi(token_used);
CREATE INDEX IF NOT EXISTS idx_absensi_nama_kelas_token ON absensi(LOWER(TRIM(nama)), kelas, token_used);
CREATE INDEX IF NOT EXISTS idx_absensi_device_token ON absensi(device_id, token_used);
CREATE INDEX IF NOT EXISTS idx_absensi_created_at ON absensi(created_at DESC);

-- Contoh Data Awal (Opsional untuk testing token aktif 30 menit)
-- INSERT INTO tokens (code, expires_at, is_active) 
-- VALUES ('ROBO-DEMO', CURRENT_TIMESTAMP + INTERVAL '30 minutes', TRUE)
-- ON CONFLICT (code) DO NOTHING;
