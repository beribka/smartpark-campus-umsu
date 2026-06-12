// server.js
// ============================================
//   SmartPark Campus UMSU - Main Server
//   Node.js + Express.js Backend
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve folder uploads secara statis
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Serve file HTML frontend
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'smartpark_campus_api.html'));
});

// ============================================
// Routes
// ============================================
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/parking',  require('./routes/parking'));
app.use('/api/logs',     require('./routes/logs'));
app.use('/api/users',    require('./routes/users'));

// ============================================
// Health Check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SmartPark Campus API berjalan.',
    time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  });
});

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} tidak ditemukan.` });
});

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Ukuran file terlalu besar (max 5MB).' });
  }
  res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ============================================
// Auto Setup Admin saat Server Start
// ============================================
async function setupAdmin() {
  try {
    const db = require('./config/db');
    const bcrypt = require('bcryptjs');

    // Buat tabel jika belum ada
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(150) NOT NULL,
      nim VARCHAR(50) NOT NULL,
      status ENUM('mahasiswa','dosen','staff','admin') NOT NULL DEFAULT 'mahasiswa',
      role ENUM('admin','user') NOT NULL DEFAULT 'user',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await db.query(`CREATE TABLE IF NOT EXISTS vehicles (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      qr_id VARCHAR(20) NOT NULL UNIQUE,
      user_id VARCHAR(36) NOT NULL,
      nama VARCHAR(150) NOT NULL,
      nim VARCHAR(50) NOT NULL,
      status ENUM('mahasiswa','dosen','staff') NOT NULL,
      jenis ENUM('motor','mobil') NOT NULL,
      plat VARCHAR(20) NOT NULL UNIQUE,
      merk VARCHAR(100) NOT NULL,
      warna VARCHAR(50) NOT NULL,
      img_stnk TEXT, img_plat TEXT, img_kendaraan TEXT,
      registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await db.query(`CREATE TABLE IF NOT EXISTS pending_vehicles (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      nama VARCHAR(150) NOT NULL,
      nim VARCHAR(50) NOT NULL,
      status ENUM('mahasiswa','dosen','staff') NOT NULL,
      jenis ENUM('motor','mobil') NOT NULL,
      plat VARCHAR(20) NOT NULL,
      merk VARCHAR(100) NOT NULL,
      warna VARCHAR(50) NOT NULL,
      img_stnk TEXT, img_plat TEXT, img_kendaraan TEXT,
      verif ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME, reviewed_by VARCHAR(36),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await db.query(`CREATE TABLE IF NOT EXISTS inside_vehicles (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      qr_id VARCHAR(20) NOT NULL UNIQUE,
      vehicle_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      nama VARCHAR(150) NOT NULL,
      plat VARCHAR(20) NOT NULL,
      jenis ENUM('motor','mobil') NOT NULL,
      entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await db.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      qr_id VARCHAR(20) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      nama VARCHAR(150) NOT NULL,
      nim VARCHAR(50) NOT NULL,
      plat VARCHAR(20) NOT NULL,
      jenis ENUM('motor','mobil') NOT NULL,
      status VARCHAR(50) NOT NULL,
      type ENUM('in','out') NOT NULL,
      duration VARCHAR(50),
      time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    // Set password admin
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);

    // Insert admin jika belum ada
    await db.query(
      `INSERT INTO users (id, email, password, name, nim, status, role)
       VALUES ('u-admin-001', 'admin', ?, 'Administrator', 'ADMIN-001', 'admin', 'admin')
       ON DUPLICATE KEY UPDATE password = ?`,
      [hash, hash]
    );

    console.log('✅ Database MySQL terhubung.');
    console.log(`🔐 Admin password set: ${adminPass}`);
  } catch (err) {
    console.error('❌ Gagal setup database:', err.message);
    process.exit(1);
  }
}

// ============================================
// Start Server
// ============================================
app.listen(PORT, async () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║    SmartPark Campus UMSU - Backend     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`🚀 Server berjalan di  : http://localhost:${PORT}`);
  console.log(`📁 Upload folder       : ${uploadDir}`);
  console.log(`🔑 JWT Expires in      : ${process.env.JWT_EXPIRES_IN || '7d'}`);
  console.log('');
  await setupAdmin();
});
