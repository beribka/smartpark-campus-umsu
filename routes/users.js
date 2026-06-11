// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ============================================
// GET /api/users — Semua user (admin)
// ============================================
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.email, u.name, u.nim, u.status, u.role, u.created_at,
              COUNT(DISTINCT v.id) as vehicle_count
       FROM users u
       LEFT JOIN vehicles v ON v.user_id = u.id
       WHERE u.role != 'admin'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pengguna.' });
  }
});

// ============================================
// DELETE /api/users/:id — Hapus user (admin)
// ============================================
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri.' });
    }

    const [result] = await db.query('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
});

// ============================================
// GET /api/users/me — Profil user login
// ============================================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, name, nim, status, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil profil.' });
  }
});

module.exports = router;
