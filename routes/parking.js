// routes/parking.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

function genId() {
  return 'ins-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}
function genLogId() {
  return 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}
function formatDuration(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}j ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}d`;
  return `${s} detik`;
}

// ============================================
// POST /api/parking/masuk — Proses kendaraan masuk
// Body: { qrId }
// ============================================
router.post('/masuk', authMiddleware, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { qrId } = req.body;
    if (!qrId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'QR ID wajib diisi.' });
    }

    const qrUpper = qrId.toUpperCase().trim();

    // Cari kendaraan
    const [vehicles] = await conn.query('SELECT * FROM vehicles WHERE qr_id = ?', [qrUpper]);
    if (vehicles.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: `QR ID "${qrUpper}" tidak ditemukan. Pastikan kendaraan sudah terverifikasi.` });
    }
    const vehicle = vehicles[0];

    // Cek sudah di dalam
    const [alreadyInside] = await conn.query('SELECT id FROM inside_vehicles WHERE qr_id = ?', [qrUpper]);
    if (alreadyInside.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: `Kendaraan ${vehicle.plat} sudah tercatat di dalam parkir.` });
    }

    // Insert ke inside_vehicles
    const insideId = genId();
    await conn.query(
      `INSERT INTO inside_vehicles (id, qr_id, vehicle_id, user_id, nama, plat, jenis)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [insideId, qrUpper, vehicle.id, vehicle.user_id, vehicle.nama, vehicle.plat, vehicle.jenis]
    );

    // Insert log masuk
    const logId = genLogId();
    await conn.query(
      `INSERT INTO logs (id, qr_id, user_id, nama, nim, plat, jenis, status, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in')`,
      [logId, qrUpper, vehicle.user_id, vehicle.nama, vehicle.nim, vehicle.plat, vehicle.jenis, vehicle.status]
    );

    await conn.commit();
    res.json({
      success: true,
      message: `✅ ${vehicle.plat} — ${vehicle.nama} berhasil MASUK.`,
      vehicle: {
        qrId: qrUpper,
        nama: vehicle.nama,
        plat: vehicle.plat,
        jenis: vehicle.jenis,
        merk: vehicle.merk,
        warna: vehicle.warna,
        status: vehicle.status
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses kendaraan masuk.' });
  } finally {
    conn.release();
  }
});

// ============================================
// POST /api/parking/keluar — Proses kendaraan keluar
// Body: { qrId }
// ============================================
router.post('/keluar', authMiddleware, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { qrId } = req.body;
    if (!qrId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'QR ID wajib diisi.' });
    }

    const qrUpper = qrId.toUpperCase().trim();

    // Cari di dalam
    const [insideRows] = await conn.query('SELECT * FROM inside_vehicles WHERE qr_id = ?', [qrUpper]);
    if (insideRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: `Kendaraan dengan QR "${qrUpper}" tidak ada di dalam parkir.` });
    }
    const inside = insideRows[0];

    // Hitung durasi
    const entryTime = new Date(inside.entry_time);
    const exitTime = new Date();
    const durationMs = exitTime - entryTime;
    const durStr = formatDuration(durationMs);

    // Ambil detail kendaraan
    const [vehicles] = await conn.query('SELECT * FROM vehicles WHERE qr_id = ?', [qrUpper]);
    const vehicle = vehicles[0] || {};

    // Hapus dari inside
    await conn.query('DELETE FROM inside_vehicles WHERE qr_id = ?', [qrUpper]);

    // Insert log keluar
    const logId = genLogId();
    await conn.query(
      `INSERT INTO logs (id, qr_id, user_id, nama, nim, plat, jenis, status, type, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'out', ?)`,
      [logId, qrUpper, inside.user_id, inside.nama, vehicle.nim || '', inside.plat,
       inside.jenis, vehicle.status || '', durStr]
    );

    await conn.commit();
    res.json({
      success: true,
      message: `✅ ${inside.plat} — ${inside.nama} berhasil KELUAR. Durasi: ${durStr}`,
      duration: durStr,
      vehicle: {
        qrId: qrUpper,
        nama: inside.nama,
        plat: inside.plat,
        jenis: inside.jenis
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal memproses kendaraan keluar.' });
  } finally {
    conn.release();
  }
});

// ============================================
// GET /api/parking/inside — Daftar kendaraan di dalam
// ============================================
router.get('/inside', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, v.merk, v.warna, v.status as user_status,
              TIMESTAMPDIFF(MINUTE, i.entry_time, NOW()) as duration_minutes
       FROM inside_vehicles i
       LEFT JOIN vehicles v ON i.vehicle_id = v.id
       ORDER BY i.entry_time ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data kendaraan di dalam.' });
  }
});

// ============================================
// GET /api/parking/dashboard — Statistik dashboard
// ============================================
router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [[insideCount]] = await db.query('SELECT COUNT(*) as c FROM inside_vehicles');
    const [[todayIn]] = await db.query(
      'SELECT COUNT(*) as c FROM logs WHERE type = "in" AND DATE(time) = ?', [today]
    );
    const [[todayOut]] = await db.query(
      'SELECT COUNT(*) as c FROM logs WHERE type = "out" AND DATE(time) = ?', [today]
    );
    const [[pendingCount]] = await db.query(
      'SELECT COUNT(*) as c FROM pending_vehicles WHERE verif = "pending"'
    );
    const [[motorCount]] = await db.query(
      'SELECT COUNT(*) as c FROM inside_vehicles WHERE jenis = "motor"'
    );
    const [[mobilCount]] = await db.query(
      'SELECT COUNT(*) as c FROM inside_vehicles WHERE jenis = "mobil"'
    );
    const [[userCount]] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = "user"');

    const [recentLogs] = await db.query(
      `SELECT * FROM logs ORDER BY time DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        inside: insideCount.c,
        todayIn: todayIn.c,
        todayOut: todayOut.c,
        pending: pendingCount.c,
        motor: motorCount.c,
        mobil: mobilCount.c,
        users: userCount.c,
        recentLogs
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data dashboard.' });
  }
});

module.exports = router;
