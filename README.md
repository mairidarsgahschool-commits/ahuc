# AHUC Clinic System

A web-based replacement for the old VB6 + MS Access ultrasound clinic system. Same
day-to-day workflow — register a patient, pick an exam type, start from a normal-report
template, edit what's abnormal, print — but running as a proper multi-user web app with
a real database and logins.

## What's included

- **Case-type picker first** — matches the old system exactly: choose *Male Case / Female Case /
  Gynae Case / Obs Case* before entering patient details, which decides the sex and which
  report opens next.
- **Structured, organ-by-organ findings for abdominal (Male/Female Case) reports** — Liver, Gall
  Bladder, Pancreas, Spleen, Right Kidney, Left Kidney, Urinary Bladder, Prostate (Male Case
  only), and Others each have the same structured findings as the old VB6 forms (size, mass,
  echotexture, stones, dilation, etc.). Selecting a finding live-updates a plain-English
  description underneath — exactly like the old "Edit UpToDate Description" box — and that text
  remains directly editable before saving.
- **Report layout matches the old system exactly** — plain letterhead, two-row patient
  demographics (Id/Name/Age, then Sex/Date/Referred By), each organ as a label:
  description line, and a footer with the report date, reporting doctor, and time —
  all sized to true A4 portrait, both on screen and when printed.
- **Age-aware Male Case** — patients under 12 automatically get the abdominal report
  without a prostate section; 12 and over get it included. Still manually switchable
  on the report form for edge cases.
- **Three-tier obstetric biometry**, matching the old system's own categories:
  Gestational Sac Diameter (~weeks 1–9), Crown-Rump Length (~weeks 10–11), and
  Bi-Parietal Diameter (12+ weeks) each drive their own gestational-age formula and
  auto-calculate the Expected Date of Delivery — shown as its own report line, not
  folded into another section, matching the original layout.
- **Broader liver findings** — beyond the size/parenchyma/mass fields, a dedicated
  "Named conditions" picker covers cirrhosis, hepatomegaly, hemangioma, abscess,
  hydatid cyst, and calcification, on top of the fatty liver (steatosis) option
  already in place. Nothing existing was removed — these are additions.
- **QR code + shareable link on every report** — each report gets its own unguessable
  link (`/share/<type>/<token>`), rendered as a QR code right on the printed report.
  Scanning it opens a clean, read-only, no-login copy of that one report — nothing
  else in the system is reachable from that link. The link is also shown as plain
  text under the report for copy/paste (e.g. to text or WhatsApp to a patient).
- **Login / staff accounts** — role-based (`admin`, `radiologist`, `sonographer`, `staff`).
  Only admins can create or remove accounts.
- **Patients** — register, search, view history. Tracks age, sex, exam date, referring
  doctor, amount received / free-of-charge, same as the old `Patients` table.
- **Referring doctors** — simple directory, editable from the app (migrated from your old
  `Doctors` table).
- **Gynae and obstetric reports** — same normal-report-template-then-edit flow as before,
  matching your old `Gyane`/`Obs` tables field-for-field.
- **Normal-report templates** — every new report opens pre-filled with the boilerplate
  "normal" text migrated straight out of your old `Normal Obs Report`, `Normal Gyane
  Report`, and `Male/Female Report` tables, so staff only type what's actually abnormal.
- **Printable reports** — a clean, letterhead-style report view (Ali Hospital & Ultra Sound
  Centre, Thana Road Kot Addu) with a "Print / Save as PDF" button (browser print, formatted
  to hide all app chrome).
- **SQLite database** — a single file (`db/ahuc.sqlite3`), no separate database server to
  install or manage.

## What was migrated from `AHUC.mdb`

Your uploaded Access database was read directly (tables: `Doctors`, `Patients`, `Male`,
`Gyane`, `Obs`, and the four `Normal ... Report` boilerplate tables). The **referring
doctors list** and the **normal-report boilerplate text** were imported automatically by
the seed script — see `scripts/legacy-data/*.csv` for the raw export and
`scripts/seed.js` for the import logic.

The old `Patients`/`Male`/`Gyane`/`Obs` tables in your file mostly contained placeholder
test rows (names like "kkk", "kdjfkj"), so actual patient records were **not** imported —
starting the new system with a clean patient list. If you do have real historical patient
data to bring across, send it separately (or the real `.mdb`/`.accdb`) and I can write an
import for that too — it's the same pattern as `scripts/seed.js`.

## Running it

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run seed     # first time only — creates the database, a default login, and imports
                  # doctors + normal-report templates from scripts/legacy-data
npm start
```

Then open **http://localhost:3000**.

Default login (change this immediately from Staff Accounts once you're in):

```
username: admin
password: changeme123
```

## Project layout

```
server.js              Express app — all routes
db/db.js                SQLite connection + schema
db/ahuc.sqlite3          the actual database file (created on first run)
scripts/seed.js          one-time import of doctors + normal-report templates
scripts/legacy-data/     CSV export of your original Access tables
views/                   EJS page templates
public/css/style.css     all styling
```

## Notes on going live

This is built to be self-hosted — on a clinic PC, a small VPS, or an office server:

- **Sessions** currently use the default in-memory store, so logins reset if the app
  restarts. Fine for a single always-on machine; if you deploy across multiple
  processes or want logins to survive restarts, swap in a persistent session store
  (e.g. `session-file-store`).
- **Backups** are just the one file: `db/ahuc.sqlite3`. Back it up like any other file —
  copy it somewhere safe on whatever schedule you already use for the Access file.
- **HTTPS**: if this will be reachable outside the clinic's local network, put it behind
  a reverse proxy (nginx/Caddy) with TLS rather than exposing port 3000 directly.
- **Environment variables**: copy `.env.example` to `.env` to set `PORT` and
  `SESSION_SECRET` for your deployment.

## Extending it

The schema and forms are intentionally close to your old Access tables, so it should be
straightforward to add fields (e.g. more measurements, a fixed set of impression
phrases, clinic letterhead logo) — everything lives in `db/db.js` (schema),
`server.js` (routes), and the matching file in `views/`.
