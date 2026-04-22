const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = __dirname;

function listDbCandidates(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(db|sqlite|sqlite3)$/i.test(f))
    .map(f => path.join(dir, f));
}

function resolveDatabasePath() {
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);

  const dirs = [ROOT, path.join(ROOT, "data")];
  let candidates = [];

  for (const d of dirs) {
    candidates = candidates.concat(listDbCandidates(d));
  }

  if (candidates.length > 0) return candidates[0];

  const dataDir = path.join(ROOT, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  return path.join(dataDir, "chadsite.sqlite");
}

const dbPath = resolveDatabasePath();
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function hasColumn(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === column);
}

// USERS

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`).run();

const userColumns = [
  ["is_disabled", "INTEGER NOT NULL DEFAULT 0"],
  ["disabled_until", "TEXT"],
  ["disable_reason", "TEXT"],
  ["must_reset_password", "INTEGER NOT NULL DEFAULT 0"],
  ["password_reset_token", "INTEGER NOT NULL DEFAULT 0"]
];

for (const [col, def] of userColumns) {
  if (!hasColumn("users", col)) {
    db.prepare(`ALTER TABLE users ADD COLUMN ${col} ${def}`).run();
  }
}

// SERVICES

db.prepare(`
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT,
  is_external INTEGER NOT NULL DEFAULT 0
)
`).run();

const serviceColumns = [
  ["slug", "TEXT"],
  ["min_role", "TEXT NOT NULL DEFAULT 'user'"],
  ["is_enabled", "INTEGER NOT NULL DEFAULT 1"],
  ["sort_order", "INTEGER NOT NULL DEFAULT 0"]
];

for (const [col, def] of serviceColumns) {
  if (!hasColumn("services", col)) {
    db.prepare(`ALTER TABLE services ADD COLUMN ${col} ${def}`).run();
  }
}

// PERMISSIONS (legacy, kept for compatibility)

db.prepare(`
CREATE TABLE IF NOT EXISTS permissions (
  user_id INTEGER,
  service_id INTEGER,
  UNIQUE(user_id, service_id)
)
`).run();

// Normalize roles

db.prepare(`UPDATE users SET role = 'user' WHERE role NOT IN ('user','admin','super_admin')`).run();

// Populate slugs if missing

const services = db.prepare("SELECT id, name, path, slug FROM services").all();
const seen = new Set();

function toSlug(str) {
  return String(str || "service").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

for (const s of services) {
  if (!s.slug) {
    let base = toSlug(s.name || s.path || `service-${s.id}`) || `service-${s.id}`;
    let slug = base;
    let i = 1;

    while (seen.has(slug) || db.prepare("SELECT 1 FROM services WHERE slug = ?").get(slug)) {
      slug = `${base}-${i++}`;
    }

    seen.add(slug);
    db.prepare("UPDATE services SET slug = ? WHERE id = ?").run(slug, s.id);
  }
}

module.exports = db;
