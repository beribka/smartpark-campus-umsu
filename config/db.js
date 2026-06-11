// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smartpark_campus',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00',
});

// Test koneksi saat server start
pool.getConnection()
  .then(conn => {
    console.log('✅ Database MySQL terhubung.');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Gagal terhubung ke database:', err.message);
    process.exit(1);
  });

module.exports = pool;
