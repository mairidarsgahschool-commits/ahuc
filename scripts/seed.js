// scripts/seed.js
// Run with: npm run seed
// Creates a default admin login and imports doctors + "normal report" boilerplate
// text from the legacy MS Access export (scripts/legacy-data/*.csv), if present.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db } = require('../db/db');

const LEGACY_DIR = path.join(__dirname, 'legacy-data');

function parseCsv(text) {
  // Minimal CSV parser that handles quoted fields with embedded commas/newlines.
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length === headers.length).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = r[idx]);
    return obj;
  });
}

function loadCsv(filename) {
  const p = path.join(LEGACY_DIR, filename);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) { console.log('· users already seeded, skipping'); return; }
  const hash = bcrypt.hashSync('changeme123', 10);
  db.prepare(`INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)`)
    .run('admin', hash, 'Clinic Administrator', 'admin');
  console.log('· created default login  ->  username: admin   password: changeme123');
  console.log('  (change this immediately in Staff Accounts after first login)');
}

function seedDoctors() {
  const count = db.prepare('SELECT COUNT(*) c FROM doctors').get().c;
  if (count > 0) { console.log('· doctors already seeded, skipping'); return; }
  const rows = loadCsv('Doctors.csv');
  const insert = db.prepare('INSERT INTO doctors (name) VALUES (?)');
  const tx = db.transaction((rows) => {
    if (!rows.length) {
      insert.run('Self / Walk-in');
      return;
    }
    for (const r of rows) insert.run((r.doct_name || '').trim() || 'Unnamed');
  });
  tx(rows);
  console.log(`· imported ${Math.max(rows.length, 1)} referring doctor(s) from legacy data`);
}

function seedTemplates() {
  const count = db.prepare('SELECT COUNT(*) c FROM templates').get().c;
  if (count > 0) { console.log('· templates already seeded, skipping'); return; }
  const insert = db.prepare('INSERT INTO templates (type, name, data_json) VALUES (?,?,?)');

  const withProstate = loadCsv('Male_Report_with_Prostate.csv')[0];
  const withoutProstate = loadCsv('Male_Report_without_Prostate.csv')[0]
    || loadCsv('Female_Normal_Report.csv')[0];
  const gynae = loadCsv('Normal_Gyane_Report.csv')[0];
  const obs = loadCsv('Normal_Obs_Report.csv')[0];

  const tx = db.transaction(() => {
    if (withProstate) {
      insert.run('male_with_prostate', 'Normal (with prostate)', JSON.stringify({
        liver: withProstate.liver, gall_bladder: withProstate.gall_bladr,
        pancreas: withProstate.pancreas, spleen: withProstate.spleen,
        kidney_r: withProstate.kidney_r, kidney_l: withProstate.kidney_l,
        urinary_bladder: withProstate.urinary_b, prostate: withProstate.prostate,
        others: withProstate.others, remarks: withProstate.remarks
      }));
    }
    if (withoutProstate) {
      insert.run('male_without_prostate', 'Normal (no prostate / female abdominal)', JSON.stringify({
        liver: withoutProstate.liver, gall_bladder: withoutProstate.gall_bladr,
        pancreas: withoutProstate.pancreas, spleen: withoutProstate.spleen,
        kidney_r: withoutProstate.kidney_r, kidney_l: withoutProstate.kidney_l,
        urinary_bladder: withoutProstate.urinary_b, prostate: '',
        others: withoutProstate.others, remarks: withoutProstate.remarks
      }));
    }
    if (gynae) {
      insert.run('gynae', 'Normal gynae', JSON.stringify({
        uterus: gynae.uterus, adnexa_l: gynae.adnexa_l, adnexa_r: gynae.adnexa_r,
        ovary_r: gynae.ovary_r, ovary_l: gynae.ovary_l,
        pouch_douglas: gynae.pouch_doug, remarks: gynae.remarks
      }));
    }
    if (obs) {
      insert.run('obs', 'Normal obstetric', JSON.stringify({
        gestation: obs.gestation, amniotic_fluid: obs.amniotic_f, placenta: obs.placenta,
        cvs: obs.cvs, lie: obs.lie, fetal_morphology: obs.fetal_morp,
        biometry: obs.biometery, remarks: obs.remarks
      }));
    }
  });
  tx();
  console.log('· imported normal-report boilerplate templates from legacy data');
}

seedUsers();
seedDoctors();
seedTemplates();
console.log('\nSeed complete.');
