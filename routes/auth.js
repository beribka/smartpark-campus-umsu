// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('crypto').webcrypto ? require('crypto') : { v4: () => 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2) };
const db = require('../config/db');

// Helper buat UUID sederhana kalau crypto.randomUUID tidak tersedia
function genUUID() {
  return 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, nim, status } = req.body;

    if (!email || !password || !name || !nim || !status) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const id = genUUID();

    await db.query(
      'INSERT INTO users (id, email, password, name, nim, status, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, hashed, name, nim, status, 'user']
    );

    res.status(201).json({ success: true, message: 'Akun berhasil dibuat! Silakan login.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, nim: user.nim },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nim: user.nim,
        status: user.status,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// ============================================
// PUT /api/auth/change-password
// ============================================
router.put('/change-password', require('../middleware/auth').authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const match = await bcrypt.compare(oldPassword, rows[0].password);
    if (!match) return res.status(401).json({ success: false, message: 'Password lama salah.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});


// ============================================
// POST /api/auth/reset-password
// ============================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, message: "Email dan password baru wajib diisi." });
    if (newPassword.length < 6) return res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Email/username tidak ditemukan." });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password = ? WHERE email = ?", [hashed, email]);
    res.json({ success: true, message: "Password berhasil direset." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
});

module.exports = router;
