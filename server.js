require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const { db } = require('./db/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // so req.protocol reflects the real scheme behind Railway's proxy
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// NOTE: uses the default in-memory session store, which is fine for a single-process
// clinic deployment but resets on restart and won't scale across multiple processes.
// Swap in a persistent store (e.g. `session-file-store`) if that matters for you.
app.use(session({
  secret: process.env.SESSION_SECRET || 'ahuc-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12h
}));

// Make current user + helpers available in every view
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" (UTC, no timezone marker),
  // which JS can parse inconsistently — normalize it to a real ISO string first.
  function parseSqliteDatetime(d) {
    if (!d) return null;
    const iso = d.includes('T') ? d : d.replace(' ', 'T') + 'Z';
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
  }
  res.locals.fmtDateLong = (d) => {
    const dt = parseSqliteDatetime(d);
    if (!dt) return d || '—';
    return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };
  res.locals.fmtTime = (d) => {
    const dt = parseSqliteDatetime(d);
    if (!dt) return '';
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  };
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Admins only.');
  next();
}

function genToken() {
  return crypto.randomBytes(12).toString('hex'); // 24-char unguessable token
}

// Builds the public share URL + a QR code (data URL) for a given report.
async function buildShare(req, kind, token) {
  const shareUrl = `${req.protocol}://${req.get('host')}/share/${kind}/${token}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 180, color: { dark: '#0E2A30', light: '#FFFFFF' } });
  return { shareUrl, qrDataUrl };
}

/* ---------------- AUTH ---------------- */
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('login', { error: 'Incorrect username or password.' });
  }
  req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- DASHBOARD ---------------- */
app.get('/', requireAuth, (req, res) => {
  const recentPatients = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id
    ORDER BY p.id DESC LIMIT 8
  `).all();
  const stats = {
    totalPatients: db.prepare('SELECT COUNT(*) c FROM patients').get().c,
    totalMale: db.prepare('SELECT COUNT(*) c FROM male_reports').get().c,
    totalGynae: db.prepare('SELECT COUNT(*) c FROM gynae_reports').get().c,
    totalObs: db.prepare('SELECT COUNT(*) c FROM obs_reports').get().c,
    todayCount: db.prepare(`SELECT COUNT(*) c FROM patients WHERE exam_date = date('now')`).get().c
  };
  const totalReports = stats.totalMale + stats.totalGynae + stats.totalObs;
  res.render('dashboard', { recentPatients, stats, totalReports });
});

/* ---------------- DOCTORS ---------------- */
app.get('/doctors', requireAuth, (req, res) => {
  const doctors = db.prepare('SELECT * FROM doctors ORDER BY name').all();
  res.render('doctors', { doctors });
});
app.post('/doctors', requireAuth, (req, res) => {
  const name = (req.body.name || '').trim();
  if (name) db.prepare('INSERT INTO doctors (name) VALUES (?)').run(name);
  res.redirect('/doctors');
});
app.post('/doctors/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);
  res.redirect('/doctors');
});

/* ---------------- STAFF ACCOUNTS (admin only) ---------------- */
app.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id').all();
  res.render('users', { users, error: null });
});
app.post('/users', requireAdmin, (req, res) => {
  const { username, password, full_name, role } = req.body;
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id').all();
  if (!username || !password || !full_name) {
    return res.render('users', { users, error: 'All fields are required.' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
      .run(username.trim(), hash, full_name.trim(), role || 'staff');
    res.redirect('/users');
  } catch (e) {
    res.render('users', { users, error: 'That username is already taken.' });
  }
});
app.post('/users/:id/delete', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.session.user.id) return res.redirect('/users');
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.redirect('/users');
});

/* ---------------- PATIENTS ---------------- */
app.get('/patients', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT p.*, d.name AS ref_doctor_name FROM patients p
      LEFT JOIN doctors d ON d.id = p.ref_doctor_id
      WHERE p.name LIKE ? OR p.id = ?
      ORDER BY p.id DESC
    `).all(`%${q}%`, isNaN(Number(q)) ? -1 : Number(q));
  } else {
    rows = db.prepare(`
      SELECT p.*, d.name AS ref_doctor_name FROM patients p
      LEFT JOIN doctors d ON d.id = p.ref_doctor_id
      ORDER BY p.id DESC LIMIT 200
    `).all();
  }
  res.render('patients-list', { patients: rows, q });
});

const CASE_LABELS = { male: 'Male Case', female: 'Female Case', gynae: 'Gynae Case', obs: 'Obs Case' };

app.get('/patients/new', requireAuth, (req, res) => {
  const caseType = req.query.case;
  if (!caseType || !CASE_LABELS[caseType]) {
    return res.render('patient-case-picker');
  }
  const doctors = db.prepare('SELECT * FROM doctors ORDER BY name').all();
  const sex = (caseType === 'male') ? 'Male' : 'Female';
  res.render('patient-form', {
    doctors, sex, caseType, caseLabel: CASE_LABELS[caseType],
    today: new Date().toISOString().slice(0, 10)
  });
});

app.post('/patients', requireAuth, (req, res) => {
  const { name, age, sex, exam_date, ref_doctor_id, amount_received, is_free, case: caseType } = req.body;
  const info = db.prepare(`
    INSERT INTO patients (name, age, sex, exam_date, ref_doctor_id, amount_received, is_free, created_by)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    (name || '').trim(), (age || '').trim(), sex, exam_date,
    ref_doctor_id || null, Number(amount_received) || 0, is_free ? 1 : 0,
    req.session.user.id
  );
  const id = info.lastInsertRowid;
  if (caseType === 'male') {
    // Prostate findings don't apply to pre-adolescent boys — auto-pick the right
    // template by age, while still leaving the toggle on the form for edge cases.
    const ageNum = parseInt(age, 10);
    const template = (!isNaN(ageNum) && ageNum < 12) ? 'without_prostate' : 'with_prostate';
    return res.redirect(`/patients/${id}/report/male/new?template=${template}`);
  }
  if (caseType === 'female') return res.redirect(`/patients/${id}/report/male/new?template=without_prostate`);
  if (caseType === 'gynae') return res.redirect(`/patients/${id}/report/gynae/new`);
  if (caseType === 'obs') return res.redirect(`/patients/${id}/report/obs/new`);
  res.redirect(`/patients/${id}`);
});

app.get('/patients/:id', requireAuth, (req, res) => {
  const patient = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id WHERE p.id = ?
  `).get(req.params.id);
  if (!patient) return res.status(404).send('Patient not found.');
  const maleReports = db.prepare('SELECT * FROM male_reports WHERE patient_id = ? ORDER BY id DESC').all(patient.id);
  const gynaeReports = db.prepare('SELECT * FROM gynae_reports WHERE patient_id = ? ORDER BY id DESC').all(patient.id);
  const obsReports = db.prepare('SELECT * FROM obs_reports WHERE patient_id = ? ORDER BY id DESC').all(patient.id);
  res.render('patient-detail', { patient, maleReports, gynaeReports, obsReports });
});

/* ---------------- MALE / ABDOMINAL REPORT ---------------- */
app.get('/patients/:id/report/male/new', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).send('Patient not found.');
  const templateType = req.query.template === 'with_prostate' ? 'male_with_prostate' : 'male_without_prostate';
  const tpl = db.prepare('SELECT * FROM templates WHERE type = ? ORDER BY id DESC LIMIT 1').get(templateType);
  const data = tpl ? JSON.parse(tpl.data_json) : {};
  res.render('report-male-form', {
    patient, data, hasProstate: templateType === 'male_with_prostate',
    currentUser: req.session.user, editing: false, reportId: null
  });
});

app.post('/patients/:id/report/male', requireAuth, (req, res) => {
  const f = req.body;
  const info = db.prepare(`
    INSERT INTO male_reports
      (patient_id, liver, gall_bladder, pancreas, spleen, kidney_r, kidney_l, urinary_bladder,
       prostate, others, remarks, has_prostate, sonographer, radiologist, created_by, share_token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.params.id, f.liver, f.gall_bladder, f.pancreas, f.spleen, f.kidney_r, f.kidney_l,
    f.urinary_bladder, f.prostate || '', f.others, f.remarks, f.has_prostate ? 1 : 0,
    f.sonographer, f.radiologist, req.session.user.id, genToken()
  );
  res.redirect(`/reports/male/${info.lastInsertRowid}/print`);
});

app.get('/reports/male/:id/edit', requireAuth, (req, res) => {
  const report = db.prepare('SELECT * FROM male_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(report.patient_id);
  res.render('report-male-form', {
    patient, data: report, hasProstate: !!report.has_prostate,
    currentUser: req.session.user, editing: true, reportId: report.id
  });
});

app.post('/reports/male/:id/edit', requireAuth, (req, res) => {
  const f = req.body;
  db.prepare(`
    UPDATE male_reports SET
      liver=?, gall_bladder=?, pancreas=?, spleen=?, kidney_r=?, kidney_l=?, urinary_bladder=?,
      prostate=?, others=?, remarks=?, has_prostate=?, sonographer=?, radiologist=?
    WHERE id=?
  `).run(
    f.liver, f.gall_bladder, f.pancreas, f.spleen, f.kidney_r, f.kidney_l,
    f.urinary_bladder, f.prostate || '', f.others, f.remarks, f.has_prostate ? 1 : 0,
    f.sonographer, f.radiologist, req.params.id
  );
  res.redirect(`/reports/male/${req.params.id}/print`);
});

app.get('/reports/male/:id/print', requireAuth, async (req, res) => {
  let report = db.prepare('SELECT * FROM male_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  if (!report.share_token) {
    const token = genToken();
    db.prepare('UPDATE male_reports SET share_token = ? WHERE id = ?').run(token, report.id);
    report = { ...report, share_token: token };
  }
  const patient = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id WHERE p.id = ?
  `).get(report.patient_id);
  const { shareUrl, qrDataUrl } = await buildShare(req, 'male', report.share_token);
  res.render('report-print', { report, patient, type: 'Abdominal / Male Ultrasound', editUrl: `/reports/male/${report.id}/edit`, shareUrl, qrDataUrl });
});

/* ---------------- GYNAE REPORT ---------------- */
app.get('/patients/:id/report/gynae/new', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).send('Patient not found.');
  const tpl = db.prepare(`SELECT * FROM templates WHERE type = 'gynae' ORDER BY id DESC LIMIT 1`).get();
  const data = tpl ? JSON.parse(tpl.data_json) : {};
  res.render('report-gynae-form', { patient, data, currentUser: req.session.user, editing: false, reportId: null });
});

app.post('/patients/:id/report/gynae', requireAuth, (req, res) => {
  const f = req.body;
  const info = db.prepare(`
    INSERT INTO gynae_reports
      (patient_id, uterus, adnexa_l, adnexa_r, ovary_r, ovary_l, pouch_douglas, remarks,
       sonographer, radiologist, created_by, share_token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.params.id, f.uterus, f.adnexa_l, f.adnexa_r, f.ovary_r, f.ovary_l, f.pouch_douglas,
    f.remarks, f.sonographer, f.radiologist, req.session.user.id, genToken()
  );
  res.redirect(`/reports/gynae/${info.lastInsertRowid}/print`);
});

app.get('/reports/gynae/:id/edit', requireAuth, (req, res) => {
  const report = db.prepare('SELECT * FROM gynae_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(report.patient_id);
  res.render('report-gynae-form', { patient, data: report, currentUser: req.session.user, editing: true, reportId: report.id });
});

app.post('/reports/gynae/:id/edit', requireAuth, (req, res) => {
  const f = req.body;
  db.prepare(`
    UPDATE gynae_reports SET
      uterus=?, adnexa_l=?, adnexa_r=?, ovary_r=?, ovary_l=?, pouch_douglas=?, remarks=?,
      sonographer=?, radiologist=?
    WHERE id=?
  `).run(f.uterus, f.adnexa_l, f.adnexa_r, f.ovary_r, f.ovary_l, f.pouch_douglas, f.remarks,
    f.sonographer, f.radiologist, req.params.id);
  res.redirect(`/reports/gynae/${req.params.id}/print`);
});

app.get('/reports/gynae/:id/print', requireAuth, async (req, res) => {
  let report = db.prepare('SELECT * FROM gynae_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  if (!report.share_token) {
    const token = genToken();
    db.prepare('UPDATE gynae_reports SET share_token = ? WHERE id = ?').run(token, report.id);
    report = { ...report, share_token: token };
  }
  const patient = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id WHERE p.id = ?
  `).get(report.patient_id);
  const { shareUrl, qrDataUrl } = await buildShare(req, 'gynae', report.share_token);
  res.render('report-print', { report, patient, type: 'Gynaecological Ultrasound', editUrl: `/reports/gynae/${report.id}/edit`, shareUrl, qrDataUrl });
});

/* ---------------- OBSTETRIC REPORT ---------------- */
app.get('/patients/:id/report/obs/new', requireAuth, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).send('Patient not found.');
  const tpl = db.prepare(`SELECT * FROM templates WHERE type = 'obs' ORDER BY id DESC LIMIT 1`).get();
  const data = tpl ? JSON.parse(tpl.data_json) : {};
  res.render('report-obs-form', { patient, data, currentUser: req.session.user, editing: false, reportId: null });
});

app.post('/patients/:id/report/obs', requireAuth, (req, res) => {
  const f = req.body;
  const info = db.prepare(`
    INSERT INTO obs_reports
      (patient_id, gestation, amniotic_fluid, placenta, cvs, lie, fetal_morphology, biometry, edd,
       remarks, sonographer, radiologist, created_by, share_token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.params.id, f.gestation, f.amniotic_fluid, f.placenta, f.cvs, f.lie, f.fetal_morphology,
    f.biometry, f.edd, f.remarks, f.sonographer, f.radiologist, req.session.user.id, genToken()
  );
  res.redirect(`/reports/obs/${info.lastInsertRowid}/print`);
});

app.get('/reports/obs/:id/edit', requireAuth, (req, res) => {
  const report = db.prepare('SELECT * FROM obs_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(report.patient_id);
  res.render('report-obs-form', { patient, data: report, currentUser: req.session.user, editing: true, reportId: report.id });
});

app.post('/reports/obs/:id/edit', requireAuth, (req, res) => {
  const f = req.body;
  db.prepare(`
    UPDATE obs_reports SET
      gestation=?, amniotic_fluid=?, placenta=?, cvs=?, lie=?, fetal_morphology=?, biometry=?, edd=?,
      remarks=?, sonographer=?, radiologist=?
    WHERE id=?
  `).run(f.gestation, f.amniotic_fluid, f.placenta, f.cvs, f.lie, f.fetal_morphology,
    f.biometry, f.edd, f.remarks, f.sonographer, f.radiologist, req.params.id);
  res.redirect(`/reports/obs/${req.params.id}/print`);
});

app.get('/reports/obs/:id/print', requireAuth, async (req, res) => {
  let report = db.prepare('SELECT * FROM obs_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send('Report not found.');
  if (!report.share_token) {
    const token = genToken();
    db.prepare('UPDATE obs_reports SET share_token = ? WHERE id = ?').run(token, report.id);
    report = { ...report, share_token: token };
  }
  const patient = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id WHERE p.id = ?
  `).get(report.patient_id);
  const { shareUrl, qrDataUrl } = await buildShare(req, 'obs', report.share_token);
  res.render('report-print', { report, patient, type: 'Obstetric Ultrasound', editUrl: `/reports/obs/${report.id}/edit`, shareUrl, qrDataUrl });
});

/* ---------------- PUBLIC SHARE VIEWS (no login required) ---------------- */
// Each report has its own unguessable token, so scanning a QR code only ever
// exposes that one report — never the rest of the patient list.
const SHARE_CONFIG = {
  male:  { table: 'male_reports',  type: 'Abdominal / Male Ultrasound' },
  gynae: { table: 'gynae_reports', type: 'Gynaecological Ultrasound' },
  obs:   { table: 'obs_reports',   type: 'Obstetric Ultrasound' }
};

app.get('/share/:kind/:token', (req, res) => {
  const cfg = SHARE_CONFIG[req.params.kind];
  if (!cfg) return res.status(404).send('Report not found.');
  const report = db.prepare(`SELECT * FROM ${cfg.table} WHERE share_token = ?`).get(req.params.token);
  if (!report) return res.status(404).send('Report not found, or this link has expired.');
  const patient = db.prepare(`
    SELECT p.*, d.name AS ref_doctor_name FROM patients p
    LEFT JOIN doctors d ON d.id = p.ref_doctor_id WHERE p.id = ?
  `).get(report.patient_id);
  res.render('report-share', { report, patient, type: cfg.type });
});

app.listen(PORT, () => {
  console.log(`AHUC clinic system running at http://localhost:${PORT}`);
});
