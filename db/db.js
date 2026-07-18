// db.js — SQLite connection + schema bootstrap
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'ahuc.sqlite3');
const isNew = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',   -- admin | radiologist | sonographer | staff
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  age              TEXT,
  sex              TEXT NOT NULL,          -- Male | Female
  exam_date        TEXT NOT NULL,
  ref_doctor_id    INTEGER REFERENCES doctors(id),
  amount_received  REAL NOT NULL DEFAULT 0,
  is_free          INTEGER NOT NULL DEFAULT 0,
  created_by       INTEGER REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS male_reports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  liver          TEXT, gall_bladder TEXT, pancreas TEXT, spleen TEXT,
  kidney_r       TEXT, kidney_l TEXT, urinary_bladder TEXT,
  prostate       TEXT, others TEXT, remarks TEXT,
  has_prostate   INTEGER NOT NULL DEFAULT 0,
  sonographer    TEXT, radiologist TEXT,
  created_by     INTEGER REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gynae_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uterus       TEXT, adnexa_l TEXT, adnexa_r TEXT,
  ovary_r      TEXT, ovary_l TEXT, pouch_douglas TEXT, remarks TEXT,
  sonographer  TEXT, radiologist TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS obs_reports (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  gestation         TEXT, amniotic_fluid TEXT, placenta TEXT, cvs TEXT,
  lie               TEXT, fetal_morphology TEXT, biometry TEXT, edd TEXT, remarks TEXT,
  sonographer       TEXT, radiologist TEXT,
  created_by        INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reusable boilerplate presets (seeded from the legacy "Normal Report" tables),
-- so staff can start from a known-normal report and edit only what's abnormal.
CREATE TABLE IF NOT EXISTS templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,   -- male_with_prostate | male_without_prostate | gynae | obs
  name       TEXT NOT NULL,
  data_json  TEXT NOT NULL
);
`);

module.exports = { db, isNew };
