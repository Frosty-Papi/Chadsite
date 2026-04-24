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

// Ensure active core service entries exist. Deck is deprecated and intentionally not auto-seeded.

const defaultServices = [
  { name: "Play", path: "/play", slug: "play", min_role: "user", sort_order: 10 }
];

for (const service of defaultServices) {
  const existing = db.prepare("SELECT id FROM services WHERE path = ?").get(service.path);
  if (!existing) {
    db.prepare(`
      INSERT INTO services (name, path, slug, min_role, is_enabled, sort_order, is_external)
      VALUES (?, ?, ?, ?, 1, ?, 0)
    `).run(service.name, service.path, service.slug, service.min_role, service.sort_order);
  }
}

// FRIEND REQUESTS

db.prepare(`
CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_user_id INTEGER NOT NULL,
  addressee_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_user_id, addressee_user_id),
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (requester_user_id != addressee_user_id)
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS friendships (
  user_id INTEGER NOT NULL,
  friend_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (user_id != friend_user_id)
)
`).run();

// PLAY GAMES CATALOG

db.prepare(`
CREATE TABLE IF NOT EXISTS play_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  bgg_url TEXT NOT NULL UNIQUE,
  bgg_game_id TEXT NOT NULL UNIQUE,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
)
`).run();

db.prepare(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_play_games_normalized_title
ON play_games(normalized_title)
`).run();

// GAME METADATA

db.prepare(`
CREATE TABLE IF NOT EXISTS play_game_settings (
  game_id INTEGER PRIMARY KEY,
  min_players INTEGER NOT NULL DEFAULT 1,
  max_players INTEGER NOT NULL DEFAULT 4,
  box_image_url TEXT,
  bgg_title TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES play_games(id) ON DELETE CASCADE
)
`).run();

// PLAY LOBBIES
// Existing databases may still have older configuration/state tables and columns. They are intentionally left in place
// for non-destructive migration, but the application no longer uses them.

db.prepare(`
CREATE TABLE IF NOT EXISTS play_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL UNIQUE,
  host_user_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby','started','completed','abandoned','draft','active')),
  current_players INTEGER NOT NULL DEFAULT 1,
  max_players INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  ended_at TEXT,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES play_games(id) ON DELETE RESTRICT
)
`).run();

if (hasColumn("play_sessions", "status")) {
  db.prepare(`UPDATE play_sessions SET status = 'lobby' WHERE status IN ('active','draft','open')`).run();
  db.prepare(`UPDATE play_sessions SET status = 'completed' WHERE status = 'closed'`).run();
}

db.prepare(`
CREATE TABLE IF NOT EXISTS play_session_members (
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('host','player')),
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`).run();

module.exports = db;
