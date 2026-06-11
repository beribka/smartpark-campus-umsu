-- ============================================
--   SmartPark Campus UMSU - Database Schema
--   Jalankan file ini di MySQL sebelum start server
-- ============================================

CREATE DATABASE IF NOT EXISTS smartpark_campus
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smartpark_campus;

-- ============================================
-- Tabel: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  email       VARCHAR(100) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  nim         VARCHAR(50)  NOT NULL,
  status      ENUM('mahasiswa','dosen','staff','admin') NOT NULL DEFAULT 'mahasiswa',
  role        ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Admin default: password = admin123
INSERT IGNORE INTO users (id, email, password, name, nim, status, role)
VALUES (
  'u-admin-001',
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Administrator',
  'ADMIN-001',
  'admin',
  'admin'
);

-- ============================================
-- Tabel: vehicles (kendaraan yang sudah disetujui)
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  qr_id         VARCHAR(20)   NOT NULL UNIQUE,
  user_id       VARCHAR(36)   NOT NULL,
  nama          VARCHAR(150)  NOT NULL,
  nim           VARCHAR(50)   NOT NULL,
  status        ENUM('mahasiswa','dosen','staff') NOT NULL,
  jenis         ENUM('motor','mobil') NOT NULL,
  plat          VARCHAR(20)   NOT NULL UNIQUE,
  merk          VARCHAR(100)  NOT NULL,
  warna         VARCHAR(50)   NOT NULL,
  img_stnk      TEXT,
  img_plat      TEXT,
  img_kendaraan TEXT,
  registered_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabel: pending_vehicles (kendaraan menunggu verifikasi)
-- ============================================
CREATE TABLE IF NOT EXISTS pending_vehicles (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36)   NOT NULL,
  nama          VARCHAR(150)  NOT NULL,
  nim           VARCHAR(50)   NOT NULL,
  status        ENUM('mahasiswa','dosen','staff') NOT NULL,
  jenis         ENUM('motor','mobil') NOT NULL,
  plat          VARCHAR(20)   NOT NULL,
  merk          VARCHAR(100)  NOT NULL,
  warna         VARCHAR(50)   NOT NULL,
  img_stnk      TEXT,
  img_plat      TEXT,
  img_kendaraan TEXT,
  verif         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  submitted_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   DATETIME,
  reviewed_by   VARCHAR(36),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabel: inside_vehicles (kendaraan yang sedang di dalam)
-- ============================================
CREATE TABLE IF NOT EXISTS inside_vehicles (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  qr_id       VARCHAR(20) NOT NULL UNIQUE,
  vehicle_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  nama        VARCHAR(150) NOT NULL,
  plat        VARCHAR(20) NOT NULL,
  jenis       ENUM('motor','mobil') NOT NULL,
  entry_time  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- Tabel: logs (riwayat masuk/keluar)
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
  id         VARCHAR(36)         NOT NULL PRIMARY KEY,
  qr_id      VARCHAR(20)         NOT NULL,
  user_id    VARCHAR(36)         NOT NULL,
  nama       VARCHAR(150)        NOT NULL,
  nim        VARCHAR(50)         NOT NULL,
  plat       VARCHAR(20)         NOT NULL,
  jenis      ENUM('motor','mobil') NOT NULL,
  status     VARCHAR(50)         NOT NULL,
  type       ENUM('in','out')    NOT NULL,
  duration   VARCHAR(50),
  time       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qr_id  (qr_id),
  INDEX idx_type   (type),
  INDEX idx_time   (time),
  INDEX idx_user   (user_id)
) ENGINE=InnoDB;
