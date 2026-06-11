// routes/vehicles.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');

function genQrId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = 'QR-';
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function genId() {
  return 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

// ============================================
// GET /api/vehicles — Semua kendaraan (admin)
// ============================================
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.*, u.email FROM vehicles v
       LEFT JOIN users u ON v.user_id = u.id
       ORDER BY v.registered_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data kendaraan.' });
  }
});

// ============================================
// GET /api/vehicles/mine — Kendaraan milik user login
// ============================================
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM vehicles WHERE user_id = ? ORDER BY registered_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil kendaraan Anda.' });
  }
});

// ============================================
// POST /api/vehicles/pending — Daftarkan kendaraan baru (user)
// Upload: stnk, plat, kendaraan
// ============================================
router.post(
  '/pending',
  authMiddleware,
  upload.fields([
    { name: 'stnk', maxCount: 1 },
    { name: 'plat', maxCount: 1 },
    { name: 'kendaraan', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { nama, nim, status, jenis, plat, merk, warna } = req.body;

      if (!nama || !nim || !status || !jenis || !plat || !merk || !warna) {
        return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
      }
      if (!req.files?.stnk || !req.files?.plat || !req.files?.kendaraan) {
        return res.status(400).json({ success: false, message: 'Upload foto STNK, plat, dan kendaraan.' });
      }

      const platUpper = plat.toUpperCase().trim();

      // Cek plat sudah ada
      const [existV] = await db.query('SELECT id FROM vehicles WHERE plat = ?', [platUpper]);
      if (existV.length > 0) {
        return res.status(409).json({ success: false, message: `Plat ${platUpper} sudah terdaftar.` });
      }
      const [existP] = await db.query(
        'SELECT id FROM pending_vehicles WHERE plat = ? AND verif = "pending"',
        [platUpper]
      );
      if (existP.length > 0) {
        return res.status(409).json({ success: false, message: `Plat ${platUpper} sedang menunggu verifikasi.` });
      }

      // Cek batas kendaraan
      const LIMIT = { mahasiswa: 2, dosen: 3, staff: 2 };
      const maxAllowed = LIMIT[req.user.status] || 2;
      const [countV] = await db.query('SELECT COUNT(*) as c FROM vehicles WHERE user_id = ?', [req.user.id]);
      const [countP] = await db.query(
        'SELECT COUNT(*) as c FROM pending_vehicles WHERE user_id = ? AND verif = "pending"',
        [req.user.id]
      );
      if ((countV[0].c + countP[0].c) >= maxAllowed) {
        return res.status(400).json({ success: false, message: `Batas maksimal ${maxAllowed} kendaraan telah tercapai.` });
      }

      const id = 'PND-' + Date.now();
      // URL langsung dari Cloudinary
      const imgStnk = req.files.stnk[0].path;
      const imgPlat = req.files.plat[0].path;
      const imgKendaraan = req.files.kendaraan[0].path;

      await db.query(
        `INSERT INTO pending_vehicles
         (id, user_id, nama, nim, status, jenis, plat, merk, warna, img_stnk, img_plat, img_kendaraan, verif)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [id, req.user.id, nama, nim, status, jenis, platUpper, merk, warna, imgStnk, imgPlat, imgKendaraan]
      );

      res.status(201).json({ success: true, message: 'Pendaftaran berhasil dikirim. Tunggu verifikasi admin.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Gagal mengirim pendaftaran.' });
    }
  }
);

// ============================================
// GET /api/vehicles/pending — Semua pending (admin)
// ============================================
router.get('/pending', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.email FROM pending_vehicles p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.verif = 'pending'
       ORDER BY p.submitted_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pending.' });
  }
});

// ============================================
// PUT /api/vehicles/pending/:id/approve — Approve (admin)
// ============================================
router.put('/pending/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM pending_vehicles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    }

    const p = rows[0];
    let qrId;
    // Pastikan QR ID unik
    do {
      qrId = genQrId();
      const [chk] = await conn.query('SELECT id FROM vehicles WHERE qr_id = ?', [qrId]);
      if (chk.length === 0) break;
    } while (true);

    const vid = genId();
    await conn.query(
      `INSERT INTO vehicles
       (id, qr_id, user_id, nama, nim, status, jenis, plat, merk, warna, img_stnk, img_plat, img_kendaraan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vid, qrId, p.user_id, p.nama, p.nim, p.status, p.jenis, p.plat, p.merk, p.warna,
       p.img_stnk, p.img_plat, p.img_kendaraan]
    );

    await conn.query(
      'UPDATE pending_vehicles SET verif = "approved", reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      [req.user.id, req.params.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Kendaraan disetujui dan QR Code diterbitkan.', qrId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menyetujui kendaraan.' });
  } finally {
    conn.release();
  }
});

// ============================================
// PUT /api/vehicles/pending/:id/reject — Reject (admin)
// ============================================
router.put('/pending/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id FROM pending_vehicles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });

    await db.query(
      'UPDATE pending_vehicles SET verif = "rejected", reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      [req.user.id, req.params.id]
    );
    res.json({ success: true, message: 'Kendaraan ditolak.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menolak kendaraan.' });
  }
});

// ============================================
// DELETE /api/vehicles/:qrId — Hapus kendaraan (user/admin)
// ============================================
router.delete('/:qrId', authMiddleware, async (req, res) => {
  try {
    const { qrId } = req.params;

    // Cek apakah sedang di dalam
    const [inside] = await db.query('SELECT id FROM inside_vehicles WHERE qr_id = ?', [qrId]);
    if (inside.length > 0) {
      return res.status(400).json({ success: false, message: 'Kendaraan sedang di dalam kampus, tidak bisa dihapus.' });
    }

    // Jika bukan admin, hanya bisa hapus milik sendiri
    let query = 'DELETE FROM vehicles WHERE qr_id = ?';
    const params = [qrId];
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.id);
    }

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Kendaraan tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Kendaraan berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menghapus kendaraan.' });
  }
});

// ============================================
// GET /api/vehicles/my-pending — Status pending milik user
// ============================================
router.get('/my-pending', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM pending_vehicles WHERE user_id = ? ORDER BY submitted_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data.' });
  }
});

module.exports = router;
