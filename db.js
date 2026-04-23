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

// PLAY: friend requests

db.prepare(`
CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                                            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
                                            CHECK (status IN ('pending', 'accepted', 'rejected')),
                                            CHECK (sender_id != receiver_id),
                                            UNIQUE(sender_id, receiver_id)
)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
ON friend_requests(sender_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver
ON friend_requests(receiver_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_friend_requests_status
ON friend_requests(status)
`).run();

// PLAY: confirmed friendships

db.prepare(`
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                                    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
                                    CHECK (user_id != friend_id),
                                    UNIQUE(user_id, friend_id)
)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_friends_user_id
ON friends(user_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_friends_friend_id
ON friends(friend_id)
`).run();

// PLAY: game sessions

db.prepare(`
CREATE TABLE IF NOT EXISTS game_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  host_user_id INTEGER NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  current_users INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
                                          CHECK (is_private IN (0,1)),
                                          CHECK (status IN ('open','closed')),
                                          CHECK (current_users >= 0),
                                          CHECK (max_users > 0),
                                          CHECK (current_users <= max_users)
)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_game_sessions_host_user_id
ON game_sessions(host_user_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_game_sessions_is_private
ON game_sessions(is_private)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_game_sessions_status
ON game_sessions(status)
`).run();

// Normalize roles

db.prepare(`UPDATE users SET role = 'user' WHERE role NOT IN ('user','admin','super_admin')`).run();

// Populate slugs if missing

const services = db.prepare("SELECT id, name, path, slug FROM services").all();
const seen = new Set();

function toSlug(str) {
  return String(str || "service")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");
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

// Seed Play service if missing

const playService = db.prepare("SELECT id FROM services WHERE path = ?").get("/play");
if (!playService) {
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM services").get();
  db.prepare(`
  INSERT INTO services (name, path, icon, is_external, slug, min_role, is_enabled, sort_order)
  VALUES (?, ?, ?, 0, ?, 'user', 1, ?)
  `).run(
    "Play",
    "/play",
    "🎮",
    "play",
    (maxSort?.maxSort || 0) + 1
  );
}

module.exports = db;
