const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { getUser, requireLogin, isRoleAtLeast } = require("../middleware/auth");

const router = express.Router();

db.prepare(`
CREATE TABLE IF NOT EXISTS play_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, receiver_id)
)
`).run();

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function requirePlayAccess(req, res, next) {
  const user = getUser(req);
  if (!user) return res.redirect("/login");

  const service = db.prepare("SELECT * FROM services WHERE path = ? AND is_enabled = 1").get("/play");
  if (!service) return res.status(404).send("Service not configured");
  if (!isRoleAtLeast(user.role, service.min_role || "user")) {
    return res.status(403).send("Access denied");
  }

  next();
}

function getFriendsForUser(userId) {
  return db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(userId);
}

function getPublicLobbies() {
  return db.prepare(`
    SELECT s.id, s.session_key, s.title, s.status,
           s.current_players, s.max_players,
           u.display_name, u.username,
           g.title AS game_title, g.bgg_url
    FROM play_sessions s
    JOIN users u ON u.id = s.host_user_id
    JOIN play_games g ON g.id = s.game_id
    WHERE s.status = 'lobby' AND s.visibility = 'public'
    ORDER BY s.created_at DESC
  `).all();
}

function getPrivateFriendLobbies(userId) {
  return db.prepare(`
    SELECT s.id, s.session_key, s.title, s.status,
           s.current_players, s.max_players,
           u.display_name, u.username,
           g.title AS game_title, g.bgg_url
    FROM play_sessions s
    JOIN users u ON u.id = s.host_user_id
    JOIN play_games g ON g.id = s.game_id
    JOIN friends f ON f.friend_id = s.host_user_id
    WHERE s.status = 'lobby'
      AND s.visibility = 'private'
      AND f.user_id = ?
    ORDER BY s.created_at DESC
  `).all(userId);
}

function getUserOpenLobbyOrActiveSession(userId) {
  return db.prepare(`
    SELECT s.*
    FROM play_sessions s
    JOIN play_session_members m ON m.session_id = s.id
    WHERE m.user_id = ? AND s.status IN ('lobby','active')
    ORDER BY s.created_at DESC
    LIMIT 1
  `).get(userId);
}

function extractBggGameId(url) {
  const match = String(url || "").match(/boardgamegeek\.com\/boardgame\/(\d+)\//i);
  return match ? match[1] : null;
}

function extractBggTitleFromUrl(url) {
  const match = String(url || "").match(/boardgamegeek\.com\/boardgame\/\d+\/([^/?#]+)/i);
  if (!match) return null;

  return match[1]
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userCanViewLobby(userId, session) {
  if (!session) return false;
  if (session.visibility === "public") return true;
  if (session.host_user_id === userId) return true;

  const alreadyMember = db.prepare("SELECT 1 FROM play_session_members WHERE session_id = ? AND user_id = ?")
    .get(session.id, userId);
  if (alreadyMember) return true;

  const isFriend = db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?")
    .get(userId, session.host_user_id);

  return !!isFriend;
}

router.get("/play", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const existing = getUserOpenLobbyOrActiveSession(user.id);
  if (existing) return res.redirect(`/play/session/${existing.session_key}`);

  res.render("play/index", {
    publicSessions: getPublicLobbies(),
    privateSessions: getPrivateFriendLobbies(user.id),
    friends: getFriendsForUser(user.id)
  });
});

router.get("/api/play/games/search", requireLogin, requirePlayAccess, (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ games: [] });

  const normalized = `%${normalizeName(q)}%`;
  const games = db.prepare(`
    SELECT g.id, g.title, g.bgg_url, s.min_players, s.max_players
    FROM play_games g
    LEFT JOIN play_game_settings s ON s.game_id = g.id
    WHERE g.normalized_title LIKE ?
    ORDER BY g.title COLLATE NOCASE
    LIMIT 10
  `).all(normalized);

  res.json({ games });
});

router.post("/api/play/games", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const bggUrl = String(req.body.bggUrl || "").trim();
  const maxPlayers = Number.parseInt(req.body.maxPlayers, 10) || 4;
  const minPlayers = Number.parseInt(req.body.minPlayers, 10) || 1;

  if (!/^https?:\/\/boardgamegeek\.com\/boardgame\/\d+\//i.test(bggUrl)) {
    return res.status(400).json({ error: "Invalid BoardGameGeek game URL" });
  }

  const bggGameId = extractBggGameId(bggUrl);
  const title = extractBggTitleFromUrl(bggUrl);

  if (!bggGameId || !title) return res.status(400).json({ error: "Could not parse BoardGameGeek URL" });

  const existing = db.prepare(`
    SELECT id, title
    FROM play_games
    WHERE bgg_game_id = ? OR bgg_url = ? OR normalized_title = ?
  `).get(bggGameId, bggUrl, normalizeName(title));

  if (existing) return res.status(409).json({ error: "That game already exists", game: existing });

  const gameId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO play_games (title, normalized_title, bgg_url, bgg_game_id, created_by_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, normalizeName(title), bggUrl, bggGameId, user.id);

    db.prepare(`
      INSERT INTO play_game_settings (game_id, min_players, max_players, bgg_title)
      VALUES (?, ?, ?, ?)
    `).run(result.lastInsertRowid, minPlayers, maxPlayers, title);

    return result.lastInsertRowid;
  })();

  res.json({ success: true, gameId });
});

router.post("/api/play/sessions", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const gameId = Number.parseInt(req.body.gameId, 10);
  const visibility = req.body.visibility === "private" ? "private" : "public";

  if (!Number.isInteger(gameId)) return res.status(400).json({ error: "Game is required" });

  const existing = getUserOpenLobbyOrActiveSession(user.id);
  if (existing) return res.status(409).json({ error: "You are already in an open lobby", redirectUrl: `/play/session/${existing.session_key}` });

  const game = db.prepare(`
    SELECT g.*, COALESCE(s.min_players, 1) AS min_players, COALESCE(s.max_players, 4) AS max_players
    FROM play_games g
    LEFT JOIN play_game_settings s ON s.game_id = g.id
    WHERE g.id = ?
  `).get(gameId);

  if (!game) return res.status(404).json({ error: "Game not found" });

  const sessionKey = crypto.randomBytes(16).toString("hex");
  const maxPlayers = Math.max(1, Number(game.max_players) || 4);

  const sessionId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO play_sessions (session_key, host_user_id, game_id, title, visibility, status, current_players, max_players)
      VALUES (?, ?, ?, ?, ?, 'lobby', 1, ?)
    `).run(sessionKey, user.id, game.id, game.title, visibility, maxPlayers);

    db.prepare("INSERT INTO play_session_members (session_id, user_id, role) VALUES (?, ?, 'host')")
      .run(result.lastInsertRowid, user.id);

    return result.lastInsertRowid;
  })();

  res.json({ success: true, sessionId, redirectUrl: `/play/session/${sessionKey}` });
});

router.get("/play/session/:sessionKey", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);

  const session = db.prepare(`
    SELECT s.*, g.title AS game_title, g.bgg_url,
           u.display_name, u.username
    FROM play_sessions s
    JOIN play_games g ON g.id = s.game_id
    JOIN users u ON u.id = s.host_user_id
    WHERE s.session_key = ? AND s.status IN ('lobby','active')
  `).get(req.params.sessionKey);

  if (!session) return res.status(404).send("Lobby not found");
  if (!userCanViewLobby(user.id, session)) return res.status(403).send("Forbidden");

  const member = db.prepare("SELECT * FROM play_session_members WHERE session_id = ? AND user_id = ?")
    .get(session.id, user.id);

  if (!member && session.status === "lobby") {
    if (session.current_players >= session.max_players) return res.status(409).send("Lobby is full");

    db.transaction(() => {
      db.prepare("INSERT INTO play_session_members (session_id, user_id, role) VALUES (?, ?, 'player')")
        .run(session.id, user.id);
      db.prepare("UPDATE play_sessions SET current_players = current_players + 1 WHERE id = ?")
        .run(session.id);
    })();
  }

  const members = db.prepare(`
    SELECT u.id, u.username, u.display_name, m.role, m.joined_at
    FROM play_session_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.session_id = ?
    ORDER BY CASE WHEN m.role = 'host' THEN 0 ELSE 1 END,
             COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(session.id);

  const refreshedSession = db.prepare(`
    SELECT s.*, g.title AS game_title, g.bgg_url,
           u.display_name, u.username
    FROM play_sessions s
    JOIN play_games g ON g.id = s.game_id
    JOIN users u ON u.id = s.host_user_id
    WHERE s.id = ?
  `).get(session.id);

  res.render("play/session", {
    session: refreshedSession,
    members,
    currentUser: user,
    friends: getFriendsForUser(user.id)
  });
});

router.post("/api/play/sessions/:sessionId/start", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const session = db.prepare("SELECT * FROM play_sessions WHERE id = ? AND status = 'lobby'").get(req.params.sessionId);

  if (!session) return res.status(404).json({ error: "Lobby not found" });
  if (session.host_user_id !== user.id) return res.status(403).json({ error: "Only the host can start the lobby" });

  db.prepare("UPDATE play_sessions SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?").run(session.id);
  res.json({ success: true });
});

router.post("/api/play/sessions/:sessionId/terminate", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const outcome = req.body.outcome === "completed" ? "completed" : "abandoned";
  const session = db.prepare("SELECT * FROM play_sessions WHERE id = ? AND status IN ('lobby','active')").get(req.params.sessionId);

  if (!session) return res.status(404).json({ error: "Lobby not found" });
  if (session.host_user_id !== user.id) return res.status(403).json({ error: "Only the host can close the lobby" });

  db.prepare("UPDATE play_sessions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run(outcome, session.id);
  res.json({ success: true, redirectUrl: "/play" });
});

router.post("/api/play/invite", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const sessionId = Number.parseInt(req.body.sessionId, 10);
  const friendId = Number.parseInt(req.body.friendId, 10);

  if (!Number.isInteger(sessionId) || !Number.isInteger(friendId)) return res.status(400).json({ error: "Invalid invite" });

  const session = db.prepare("SELECT * FROM play_sessions WHERE id = ? AND host_user_id = ? AND status IN ('lobby','active')")
    .get(sessionId, user.id);
  if (!session) return res.status(403).json({ error: "Only the host can invite friends" });

  const isFriend = db.prepare("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?").get(user.id, friendId);
  if (!isFriend) return res.status(403).json({ error: "You can only invite friends" });

  db.prepare("INSERT OR IGNORE INTO play_invites (session_id, sender_id, receiver_id) VALUES (?, ?, ?)")
    .run(sessionId, user.id, friendId);

  res.json({ success: true });
});

router.get("/api/play/invites", requireLogin, (req, res) => {
  const user = getUser(req);
  const invites = db.prepare(`
    SELECT i.id, s.session_key, s.title, u.username, u.display_name
    FROM play_invites i
    JOIN play_sessions s ON s.id = i.session_id
    JOIN users u ON u.id = i.sender_id
    WHERE i.receiver_id = ? AND i.status = 'pending' AND s.status IN ('lobby','active')
    ORDER BY i.created_at DESC
  `).all(user.id);

  res.json({ invites });
});

router.post("/api/play/invite/respond", requireLogin, (req, res) => {
  const user = getUser(req);
  const inviteId = Number.parseInt(req.body.inviteId, 10);
  const action = req.body.action === "decline" ? "rejected" : "accepted";

  if (!Number.isInteger(inviteId)) return res.status(400).json({ error: "Invalid invite" });

  const invite = db.prepare("SELECT * FROM play_invites WHERE id = ? AND receiver_id = ? AND status = 'pending'")
    .get(inviteId, user.id);
  if (!invite) return res.status(404).json({ error: "Invite not found" });

  db.prepare("UPDATE play_invites SET status = ? WHERE id = ?").run(action, inviteId);

  if (action === "rejected") return res.json({ success: true });

  const session = db.prepare("SELECT session_key FROM play_sessions WHERE id = ? AND status IN ('lobby','active')")
    .get(invite.session_id);

  if (!session) return res.status(404).json({ error: "Session no longer exists" });
  res.json({ success: true, redirect: `/play/session/${session.session_key}` });
});

module.exports = router;
