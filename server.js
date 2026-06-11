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
  origin: '*', // Ganti dengan domain frontend kamu di production
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
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║    SmartPark Campus UMSU - Backend     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`🚀 Server berjalan di  : http://localhost:${PORT}`);
  console.log(`📁 Upload folder       : ${uploadDir}`);
  console.log(`🔑 JWT Expires in      : ${process.env.JWT_EXPIRES_IN || '7d'}`);
  console.log('');
});
