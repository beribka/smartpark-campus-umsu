const b = require('bcryptjs');
const mysql = require('mysql2/promise');

async function run() {
  const hash = await b.hash('admin123', 10);
  console.log('Hash:', hash);
  
  const db = await mysql.createConnection({
    host: 'smartpark-campus-umsu-production.up.railway.app',
    port: 3306,
    user: 'root',
    password: 'cMwZEHuiFTlTUHKtufYNXqcFoRnJYzAZ',
    database: 'railway'
  });
  
  await db.execute('UPDATE users SET password = ? WHERE email = ?', [hash, 'admin']);
  console.log('Password berhasil diupdate!');
  await db.end();
}

run().catch(console.error);
