const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const absensiRoutes = require('./routes/absensi');
const adminRoutes = require('./routes/admin');
const { ensureTablesExist } = require('./config/db');

const app = express();

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Melayani file statis dari folder public
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'Sistem Absensi Robotik MAN 19 Jakarta',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Daftarkan Rute API
app.use('/api/absensi', absensiRoutes);
app.use('/api/admin', adminRoutes);

// Routing fallback untuk SPA / static files jika diakses langsung
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Terjadi kegagalan server!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Inisialisasi pengecekan tabel database di background
ensureTablesExist().catch(console.error);

module.exports = app;
