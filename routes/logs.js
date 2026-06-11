// routes/logs.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ============================================
// GET /api/logs — Semua log (admin), filter opsional
// Query params: ?type=in|out&date=2024-01-01&q=keyword&page=1&limit=50
// ============================================
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { type, date, q, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];

    if (type && ['in', 'out'].includes(type)) {
      where.push('type = ?');
      params.push(type);
    }
    if (date) {
      where.push('DATE(time) = ?');
      params.push(date);
    }
    if (q) {
      where.push('(nama LIKE ? OR plat LIKE ? OR qr_id LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const whereSQL = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM logs ${whereSQL}`, params
    );
    const [rows] = await db.query(
      `SELECT * FROM logs ${whereSQL} ORDER BY time DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil log.' });
  }
});

// ============================================
// GET /api/logs/my — Riwayat parkir milik user login
// ============================================
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM logs WHERE user_id = ? ORDER BY time DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat.' });
  }
});

module.exports = router;
