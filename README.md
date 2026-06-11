# SmartPark Campus UMSU — Backend API

Backend Node.js + Express.js + MySQL untuk sistem SmartPark Campus UMSU.

---

## 📁 Struktur Folder

```
smartpark-backend/
├── config/
│   └── db.js               ← Koneksi MySQL
├── middleware/
│   ├── auth.js             ← JWT middleware
│   └── upload.js           ← Multer file upload
├── routes/
│   ├── auth.js             ← Login, Register, Ganti Password
│   ├── vehicles.js         ← Pendaftaran & manajemen kendaraan
│   ├── parking.js          ← Portal masuk/keluar, dashboard
│   ├── logs.js             ← Log aktivitas parkir
│   └── users.js            ← Manajemen pengguna (admin)
├── uploads/                ← Folder foto hasil upload (auto-dibuat)
├── .env                    ← Konfigurasi environment
├── package.json
├── schema.sql              ← Script SQL buat semua tabel
└── server.js               ← Entry point utama
```

---

## ⚡ Cara Setup (Step by Step)

### 1. Install Node.js
Download dan install dari https://nodejs.org (versi LTS)

### 2. Install MySQL
Download dan install dari https://dev.mysql.com/downloads/mysql/
Atau gunakan XAMPP/Laragon yang sudah include MySQL.

### 3. Buat Database
Buka MySQL Workbench / phpMyAdmin / terminal MySQL, lalu jalankan:
```sql
-- Salin isi file schema.sql dan jalankan semua
```
Atau via terminal:
```bash
mysql -u root -p < schema.sql
```

### 4. Copy folder ini ke VSCode
Buka folder `smartpark-backend` di VSCode.

### 5. Install dependencies
Buka terminal di VSCode (Ctrl+`) lalu ketik:
```bash
npm install
```

### 6. Konfigurasi .env
Edit file `.env`, sesuaikan:
```
DB_USER=root
DB_PASSWORD=password_mysql_kamu
DB_NAME=smartpark_campus
JWT_SECRET=ganti_dengan_string_random_panjang
```

### 7. Jalankan server
```bash
# Mode biasa
npm start

# Mode development (auto-restart saat ada perubahan)
npm run dev
```

Server akan berjalan di: **http://localhost:3000**

---

## 🔑 Default Login Admin
| Field    | Value      |
|----------|------------|
| Email    | admin      |
| Password | admin123   |

---

## 📡 Daftar Endpoint API

### Auth
| Method | Endpoint                    | Akses  | Keterangan             |
|--------|-----------------------------|--------|------------------------|
| POST   | /api/auth/register          | Public | Daftar akun baru       |
| POST   | /api/auth/login             | Public | Login, dapat token JWT |
| PUT    | /api/auth/change-password   | User   | Ganti password         |

### Kendaraan
| Method | Endpoint                          | Akses | Keterangan                    |
|--------|-----------------------------------|-------|-------------------------------|
| GET    | /api/vehicles                     | Admin | Semua kendaraan               |
| GET    | /api/vehicles/mine                | User  | Kendaraan milik saya          |
| GET    | /api/vehicles/my-pending          | User  | Status pendaftaran saya       |
| POST   | /api/vehicles/pending             | User  | Daftarkan kendaraan + upload  |
| GET    | /api/vehicles/pending             | Admin | Semua pendaftaran pending     |
| PUT    | /api/vehicles/pending/:id/approve | Admin | Setujui pendaftaran           |
| PUT    | /api/vehicles/pending/:id/reject  | Admin | Tolak pendaftaran             |
| DELETE | /api/vehicles/:qrId               | Both  | Hapus kendaraan               |

### Parkir
| Method | Endpoint               | Akses | Keterangan                  |
|--------|------------------------|-------|-----------------------------|
| POST   | /api/parking/masuk     | Admin | Proses kendaraan masuk      |
| POST   | /api/parking/keluar    | Admin | Proses kendaraan keluar     |
| GET    | /api/parking/inside    | Admin | Kendaraan di dalam sekarang |
| GET    | /api/parking/dashboard | Admin | Statistik dashboard         |

### Log
| Method | Endpoint      | Akses | Keterangan                        |
|--------|---------------|-------|-----------------------------------|
| GET    | /api/logs     | Admin | Semua log (filter: type,date,q)   |
| GET    | /api/logs/my  | User  | Riwayat parkir milik saya         |

### Pengguna
| Method | Endpoint        | Akses | Keterangan              |
|--------|-----------------|-------|-------------------------|
| GET    | /api/users      | Admin | Semua pengguna          |
| GET    | /api/users/me   | User  | Profil saya             |
| DELETE | /api/users/:id  | Admin | Hapus pengguna          |

---

## 🔐 Cara Pakai Token JWT

Setelah login, gunakan token di header setiap request:
```
Authorization: Bearer <token_dari_login>
```

---

## 📸 Upload Foto Kendaraan

Gunakan `multipart/form-data` untuk endpoint POST /api/vehicles/pending.
Field yang diperlukan:
- `stnk`      — File gambar STNK
- `plat`      — File gambar plat nomor
- `kendaraan` — File gambar kendaraan

Foto tersimpan di folder `uploads/` dan bisa diakses via:
`http://localhost:3000/uploads/nama-file.jpg`

---

## 🔗 Menghubungkan ke Frontend (smartpark_campus.html)

Di file HTML kamu, ganti semua operasi `localStorage` dengan `fetch` ke API ini.

Contoh login:
```javascript
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await res.json();
if (data.success) {
  localStorage.setItem('token', data.token); // simpan token
}
```

Contoh proses masuk parkir:
```javascript
const token = localStorage.getItem('token');
const res = await fetch('http://localhost:3000/api/parking/masuk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ qrId: 'QR-XXXXXXXX' })
});
```
