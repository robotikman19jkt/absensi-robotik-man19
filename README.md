# 🤖 Aplikasi Web Absensi Full-Stack Ekstrakurikuler Robotik MAN 19 Jakarta

Aplikasi web presensi full-stack modern berbasis **Node.js**, **Express**, dan **JavaScript Native (Vanilla)** yang dirancang khusus untuk anggota Ekstrakurikuler Robotik MAN 19 Jakarta. Aplikasi ini siap dideploy ke **Vercel** (menggunakan Serverless Functions) dan terhubung dengan Database Cloud PostgreSQL (**Supabase** atau **Neon**).

---

## 🌟 Fitur Utama & Aturan Bisnis

1. **Desain Visual Futuristik & Responsif**:
   - Skema warna dominan *Deep Tech Blue* & *Electric Cyan* (`#00f0ff`, `#3b82f6`, `#070d1e`).
   - Efek modern *glassmorphism*, *cyber grid background*, dan *animated radar pulse*.
   - Menggunakan Tailwind CSS CDN & Lucide Icons.
   - Responsif sempurna di smartphone (Android/iOS) dan laptop.

2. **Geofencing GPS & Rumus Haversine**:
   - **Koordinat Pusat MAN 19 Jakarta**:
     - Latitude: `-6.250529`
     - Longitude: `106.757041`
   - **Radius Toleransi**: Maksimal **100 meter**.
   - Jarak dihitung secara akurat di backend menggunakan **Rumus Haversine**.
   - Siswa di luar radius 100 meter akan ditolak secara otomatis dengan pesan informatif yang menampilkan jarak aktual mereka.

3. **Sistem Token & Sesi 30 Menit**:
   - Token di-generate secara otomatis dari Panel Admin dengan format yang mudah dibaca (misal: `RBK-8X2K`).
   - Masa aktif token **tepat 30 menit** sejak waktu dibuat (`expires_at = CURRENT_TIMESTAMP + 30 minutes`).
   - Token yang sudah kedaluwarsa atau dinonaktifkan tidak dapat digunakan untuk presensi.

4. **Alur Presensi Siswa (Tanpa Perlu Login)**:
   - Siswa hanya perlu mengisi:
     - **Nama Lengkap**
     - **Kelas** (Dropdown terbatas: `X-A` s.d. `X-H` dan `XI-A` s.d. `XI-H`)
     - **Token Absensi**
   - Menggunakan **Browser Geolocation API** (`navigator.geolocation`) dengan mode akurasi tinggi.
   - **Anti Absen Ganda**: Sistem menolak siswa dengan Nama dan Kelas yang sama pada sesi token yang sama.

5. **Panel Admin & Rekapitulasi Data**:
   - Dilindungi **PIN Admin** sederhana (default: `ROBOTIK19`).
   - **Generator Token**: Menampilkan token aktif, waktu pembuatan, dan hitung mundur sisa waktu secara *real-time*.
   - **Live Feed & Rekap Tabel**: Menampilkan Nama, Kelas, Jam & Tanggal Absen (WIB), Jarak dari MAN 19 (meter), dan Token.
   - **Filter & Pencarian**: Filter per kelas atau pencarian nama langsung.
   - **Export Data**: Tombol satu klik untuk mengunduh rekapitulasi data ke format file `.csv` dengan header UTF-8 BOM yang langsung rapi dibuka di Microsoft Excel.

---

## 📁 Struktur Folder Project

```text
absensi-robotik-man19/
├── api/
│   ├── config/
│   │   └── db.js            # Konfigurasi PostgreSQL Pool & auto-create tables
│   ├── utils/
│   │   ├── haversine.js     # Perhitungan jarak geofencing rumus Haversine
│   │   └── token.js         # Generator kode token acak & formatter waktu WIB
│   ├── routes/
│   │   ├── absensi.js       # Route presensi siswa & validasi geolokasi
│   │   └── admin.js         # Route token admin, rekapitulasi, & ekspor data
│   └── index.js             # Entrypoint Express & Vercel Serverless Function
├── public/
│   ├── index.html           # Halaman presensi siswa (Glassmorphism & Cyber theme)
│   ├── admin.html           # Dashboard panel admin & live monitor
│   ├── favicon.svg          # Favicon robotik modern SVG
│   ├── css/
│   │   └── custom.css       # Custom neon glows, grid, scrollbar, & radar pulse
│   └── js/
│       ├── app.js           # Logic client siswa (Geolocation API + Fetch)
│       └── admin.js         # Logic admin (PIN auth, token timer, live feed, export)
├── schema.sql               # Skrip SQL pembuatan tabel PostgreSQL
├── server.js                # Local development server entrypoint
├── vercel.json              # Konfigurasi routing serverless Vercel
├── package.json             # Dependensi project Node.js
├── .env.example             # Contoh variabel lingkungan
├── .gitignore               # Daftar berkas yang diabaikan Git
└── README.md                # Dokumentasi lengkap & panduan deployment
```

---

## 🗄️ Skema Database (PostgreSQL)

Jalankan perintah SQL berikut di **Supabase SQL Editor** atau **Neon SQL Console** (opsional, aplikasi juga memiliki fitur inisialisasi tabel otomatis saat pertama kali tersambung):

```sql
-- 1. Tabel Tokens
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_tokens_code ON tokens(code);
CREATE INDEX IF NOT EXISTS idx_tokens_active_expires ON tokens(is_active, expires_at);

-- 2. Tabel Absensi
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

CREATE INDEX IF NOT EXISTS idx_absensi_token_used ON absensi(token_used);
CREATE INDEX IF NOT EXISTS idx_absensi_nama_kelas_token ON absensi(LOWER(TRIM(nama)), kelas, token_used);
CREATE INDEX IF NOT EXISTS idx_absensi_created_at ON absensi(created_at DESC);
```

---

## 🚀 Panduan Setup Database Cloud (Supabase / Neon)

### Opsi A: Menggunakan Supabase (Direkomendasikan)
1. Buka [supabase.com](https://supabase.com) dan buat akun gratis.
2. Buat project baru (misal: `robotik-man19-db`).
3. Masuk ke menu **Project Settings** -> **Database**.
4. Scroll ke bagian **Connection string**, pilih mode **URI** (atau **Transaction pooler** di port 6543 untuk serverless).
5. Salin URL koneksi tersebut dan ganti `[YOUR-PASSWORD]` dengan password database Anda.
   Contoh format:
   ```text
   postgresql://postgres.ref_anda:password_anda@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```

### Opsi B: Menggunakan Neon
1. Buka [neon.tech](https://neon.tech) dan buat project baru.
2. Di dashboard Neon, salin **Connection String** yang berakhiran `?sslmode=require`.

---

## 💻 Menjalankan di Komputer Lokal

1. Pastikan Node.js (v18+) sudah terinstall.
2. Clone atau buka folder project ini di terminal:
   ```bash
   cd absensi-robotik-man19
   ```
3. Install dependensi:
   ```bash
   npm install
   ```
4. Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
5. Isi `DATABASE_URL` di file `.env` dengan connection string database PostgreSQL Anda.
6. Jalankan server lokal:
   ```bash
   npm start
   ```
7. Buka browser:
   - **Presensi Siswa**: `http://localhost:3000`
   - **Panel Admin**: `http://localhost:3000/admin` (Default PIN: `ROBOTIK19`)

---

## ☁️ Panduan Deploy ke Vercel

1. Buat repository baru di GitHub (misal: `absensi-robotik-man19`) lalu push project ini:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit absensi robotik man 19"
   git branch -M main
   git remote add origin https://github.com/USERNAME/absensi-robotik-man19.git
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
3. Klik tombol **"Add New..."** -> **"Project"**, lalu pilih repository yang baru Anda buat.
4. Pada bagian **Environment Variables**, tambahkan variabel berikut:
   - `DATABASE_URL`: URL PostgreSQL dari Supabase / Neon (wajib)
   - `ADMIN_PIN`: PIN untuk login admin (contoh: `ROBOTIK19`)
   - `MAN19_LAT`: `-6.250529`
   - `MAN19_LON`: `106.757041`
   - `MAX_RADIUS_METERS`: `100`
5. Klik **"Deploy"**.
6. Selesai! Web presensi Anda sekarang dapat diakses secara online dari mana saja dengan HTTPS gratis (HTTPS diperlukan agar izin Geolocation GPS dapat berjalan di browser mobile).

---

## 🔒 Catatan Penting Geolocation GPS di HP / Browser
- **HTTPS Wajib**: Browser modern (Chrome, Safari, Edge) hanya mengizinkan akses Geolocation API pada protokol **HTTPS** (atau `localhost`). Saat dideploy ke Vercel, Vercel secara otomatis menyediakan sertifikat SSL HTTPS gratis.
- **Izin Lokasi**: Saat pertama kali membuka web di HP, siswa harus menekan tombol **"Izinkan" (Allow)** ketika browser meminta izin akses lokasi.
- **Mode Akurasi Tinggi**: Sangat disarankan siswa mengaktifkan GPS HP dengan mode *High Accuracy* dan berada di area terbuka di lingkungan MAN 19 Jakarta.
