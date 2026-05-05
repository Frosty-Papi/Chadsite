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

function tableExists(table) {
  return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table);
}

function hasColumn(table, column) {
  if (!tableExists(table)) return false;
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === column);
}

function addColumnIfMissing(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
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
  ["password_reset_token", "INTEGER NOT NULL DEFAULT 0"],
  ["last_seen_at", "TEXT"]
];

for (const [col, def] of userColumns) addColumnIfMissing("users", col, def);

db.prepare(`UPDATE users SET role = 'user' WHERE role NOT IN ('user','admin','super_admin')`).run();

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

for (const [col, def] of serviceColumns) addColumnIfMissing("services", col, def);

// PERMISSIONS (legacy, kept for compatibility)

db.prepare(`
CREATE TABLE IF NOT EXISTS permissions (
  user_id INTEGER,
  service_id INTEGER,
  UNIQUE(user_id, service_id)
)
`).run();

// Populate service slugs if missing
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

// FRIEND SYSTEM (canonical: friends + sender/receiver requests)

function recreateFriendRequestsIfNeeded() {
  if (!tableExists("friend_requests")) {
    db.prepare(`
      CREATE TABLE friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (sender_id != receiver_id)
      )
    `).run();
    return;
  }

  const cols = db.prepare(`PRAGMA table_info(friend_requests)`).all().map(c => c.name);
  const needsMigration = cols.includes("requester_user_id") || cols.includes("addressee_user_id");

  if (!needsMigration) return;

  db.transaction(() => {
    db.prepare(`DROP TABLE IF EXISTS friend_requests_new`).run();
    db.prepare(`
      CREATE TABLE friend_requests_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (sender_id != receiver_id)
      )
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO friend_requests_new (id, sender_id, receiver_id, status, created_at, updated_at)
      SELECT id,
             requester_user_id,
             addressee_user_id,
             CASE WHEN status IN ('pending','accepted','rejected','cancelled') THEN status ELSE 'pending' END,
             COALESCE(created_at, CURRENT_TIMESTAMP),
             COALESCE(updated_at, CURRENT_TIMESTAMP)
      FROM friend_requests
      WHERE requester_user_id IS NOT NULL
        AND addressee_user_id IS NOT NULL
        AND requester_user_id != addressee_user_id
    `).run();

    db.prepare(`DROP TABLE friend_requests`).run();
    db.prepare(`ALTER TABLE friend_requests_new RENAME TO friend_requests`).run();
  })();
}

function recreateFriendsIfNeeded() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK (user_id != friend_id)
    )
  `).run();

  if (tableExists("friendships")) {
    db.prepare(`
      INSERT OR IGNORE INTO friends (user_id, friend_id, created_at)
      SELECT user_id, friend_user_id, COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM friendships
      WHERE user_id IS NOT NULL
        AND friend_user_id IS NOT NULL
        AND user_id != friend_user_id
    `).run();

    db.prepare(`DROP TABLE friendships`).run();
  }
}

recreateFriendRequestsIfNeeded();
recreateFriendsIfNeeded();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status ON friend_requests(receiver_id, status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_status ON friend_requests(sender_id, status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id)`).run();

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

// PLAY SESSIONS (SAFE MIGRATION)

function recreatePlaySessionsTable() {
  db.transaction(() => {
    db.prepare(`DROP TABLE IF EXISTS play_sessions_new`).run();

    db.prepare(`
      CREATE TABLE play_sessions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT NOT NULL UNIQUE,
        host_user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')),
        status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('draft','lobby','active','completed','abandoned')),
        current_players INTEGER NOT NULL DEFAULT 1 CHECK(current_players >= 0),
        max_players INTEGER NOT NULL CHECK(max_players >= 1),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        ended_at TEXT,
        FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES play_games(id) ON DELETE RESTRICT
      )
    `).run();

    if (tableExists("play_sessions")) {
      db.prepare(`
        INSERT INTO play_sessions_new (
          id, session_key, host_user_id, game_id, title, visibility, status,
          current_players, max_players, created_at, started_at, ended_at
        )
        SELECT
          id,
          session_key,
          host_user_id,
          game_id,
          title,
          CASE WHEN visibility IN ('public','private') THEN visibility ELSE 'public' END,
          CASE
            WHEN status IN ('draft','open') THEN 'lobby'
            WHEN status IN ('started') THEN 'active'
            WHEN status IN ('lobby','active','completed','abandoned') THEN status
            WHEN status = 'closed' THEN 'completed'
            ELSE 'lobby'
          END,
          COALESCE(current_players, 1),
          COALESCE(max_players, 4),
          COALESCE(created_at, CURRENT_TIMESTAMP),
          started_at,
          ended_at
        FROM play_sessions
      `).run();

      db.prepare(`DROP TABLE play_sessions`).run();
    }

    db.prepare(`ALTER TABLE play_sessions_new RENAME TO play_sessions`).run();
  })();
}

recreatePlaySessionsTable();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_sessions_visibility_status ON play_sessions(visibility, status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_sessions_host_status ON play_sessions(host_user_id, status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_sessions_game_id ON play_sessions(game_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_sessions_created_at ON play_sessions(created_at DESC)`).run();

// PLAY SESSION MEMBERS

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

db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_session_members_user ON play_session_members(user_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_play_session_members_session_role ON play_session_members(session_id, role)`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS user_decks (
  user_id INTEGER PRIMARY KEY,
  builds TEXT,
  last_played INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

module.exports = db;
