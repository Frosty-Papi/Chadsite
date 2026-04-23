const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { getUser, requireLogin, isRoleAtLeast } = require("../middleware/auth");

const router = express.Router();

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
  FROM friendships f
  JOIN users u ON u.id = f.friend_user_id
  WHERE f.user_id = ?
  ORDER BY COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(userId);
}

function getPublicSessions() {
  return db.prepare(`
  SELECT s.id, s.session_key, s.title,
  s.current_players, s.max_players,
  u.display_name, u.username,
  g.title AS game_title
  FROM play_sessions s
  JOIN users u ON u.id = s.host_user_id
  JOIN play_games g ON g.id = s.game_id
  WHERE s.status = 'active' AND s.visibility = 'public'
  ORDER BY s.created_at DESC
  `).all();
}

function getPrivateFriendSessions(userId) {
  return db.prepare(`
  SELECT s.id, s.session_key, s.title,
  s.current_players, s.max_players,
  u.display_name, u.username,
  g.title AS game_title
  FROM play_sessions s
  JOIN users u ON u.id = s.host_user_id
  JOIN play_games g ON g.id = s.game_id
  JOIN friendships f ON f.friend_user_id = s.host_user_id
  WHERE s.status = 'active'
  AND s.visibility = 'private'
  AND f.user_id = ?
  ORDER BY s.created_at DESC
  `).all(userId);
}

function getHostActiveSession(hostUserId) {
  return db.prepare(`
  SELECT *
  FROM play_sessions
  WHERE host_user_id = ? AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  `).get(hostUserId);
}

function getJoinedActiveSession(userId) {
  return db.prepare(`
  SELECT s.*
  FROM play_sessions s
  JOIN play_session_members m ON m.session_id = s.id
  WHERE m.user_id = ? AND s.status = 'active'
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

router.get("/play", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);

  const hostActive = getHostActiveSession(user.id);
  if (hostActive) {
    return res.redirect(`/play/session/${hostActive.session_key}`);
  }

  const joinedActive = getJoinedActiveSession(user.id);
  if (joinedActive) {
    return res.redirect(`/play/session/${joinedActive.session_key}`);
  }

  res.render("play/index", {
    publicSessions: getPublicSessions(),
      privateSessions: getPrivateFriendSessions(user.id),
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

  if (!bggGameId || !title) {
    return res.status(400).json({ error: "Could not parse BoardGameGeek URL" });
  }

  const existing = db.prepare(`
  SELECT id, title
  FROM play_games
  WHERE bgg_game_id = ? OR bgg_url = ? OR normalized_title = ?
  `).get(bggGameId, bggUrl, normalizeName(title));

  if (existing) {
    return res.status(409).json({
      error: "That game already exists",
      game: existing
    });
  }

  const tx = db.transaction(() => {
    const result = db.prepare(`
    INSERT INTO play_games (title, normalized_title, bgg_url, bgg_game_id, created_by_user_id)
    VALUES (?, ?, ?, ?, ?)
    `).run(title, normalizeName(title), bggUrl, bggGameId, user.id);

    db.prepare(`
    INSERT INTO play_game_settings (game_id, min_players, max_players, bgg_title)
    VALUES (?, ?, ?, ?)
    `).run(result.lastInsertRowid, minPlayers, maxPlayers, title);

    return result.lastInsertRowid;
  });

  const gameId = tx();
  res.json({ success: true, gameId, redirectUrl: `/play/setup/${gameId}` });
});

router.get("/play/setup/:gameId", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);

  const game = db.prepare(`
  SELECT g.*, s.min_players, s.max_players
  FROM play_games g
  LEFT JOIN play_game_settings s ON s.game_id = g.id
  WHERE g.id = ?
  `).get(req.params.gameId);

  if (!game) return res.status(404).send("Game not found");

  const configurations = db.prepare(`
  SELECT c.*, u.display_name, u.username
  FROM play_game_configurations c
  JOIN users u ON u.id = c.owner_user_id
  WHERE c.game_id = ? AND (c.owner_user_id = ? OR c.is_public = 1)
  ORDER BY (c.owner_user_id = ?) DESC, c.updated_at DESC
  `).all(game.id, user.id, user.id);

  const defaultConfig = db.prepare(`
  SELECT *
  FROM play_game_configurations
  WHERE game_id = ? AND owner_user_id = ? AND is_default_for_owner = 1
  LIMIT 1
  `).get(game.id, user.id);

  res.render("play/setup", {
    game,
    configurations,
    defaultConfig,
    initialVisibility: req.query.visibility === "private" ? "private" : "public"
  });
});

router.post("/api/play/configurations", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const { gameId, name, description, layoutJson, isPublic, makeDefault } = req.body;

  if (!gameId || !name || !layoutJson) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let layout;
  try {
    layout = typeof layoutJson === "string" ? JSON.parse(layoutJson) : layoutJson;
  } catch {
    return res.status(400).json({ error: "Invalid layout JSON" });
  }

  const tx = db.transaction(() => {
    if (makeDefault) {
      db.prepare(`
      UPDATE play_game_configurations
      SET is_default_for_owner = 0
      WHERE game_id = ? AND owner_user_id = ?
      `).run(gameId, user.id);
    }

    const result = db.prepare(`
    INSERT INTO play_game_configurations (
      game_id, owner_user_id, name, description, layout_json, is_public, is_default_for_owner
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      gameId,
      user.id,
      String(name).trim(),
           description ? String(description).trim() : null,
           JSON.stringify(layout),
           isPublic ? 1 : 0,
           makeDefault ? 1 : 0
    );

    return result.lastInsertRowid;
  });

  const configurationId = tx();
  res.json({ success: true, configurationId });
});

router.post("/api/play/sessions", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const { gameId, configurationId, title, visibility, maxPlayers } = req.body;

  const existing = getHostActiveSession(user.id);
  if (existing) {
    return res.status(409).json({
      error: "You already have an active session",
      redirectUrl: `/play/session/${existing.session_key}`
    });
  }

  const game = db.prepare(`
  SELECT g.*, s.min_players, s.max_players
  FROM play_games g
  LEFT JOIN play_game_settings s ON s.game_id = g.id
  WHERE g.id = ?
  `).get(gameId);

  if (!game) return res.status(404).json({ error: "Game not found" });

  const finalMaxPlayers = Math.max(
    game.min_players || 1,
    Math.min(Number(maxPlayers) || game.max_players || 4, game.max_players || 4)
  );

  const sessionKey = crypto.randomBytes(16).toString("hex");

  const tx = db.transaction(() => {
    const result = db.prepare(`
    INSERT INTO play_sessions (
      session_key, host_user_id, game_id, configuration_id, title, visibility,
      status, current_players, max_players, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, ?, CURRENT_TIMESTAMP)
    `).run(
      sessionKey,
      user.id,
      gameId,
      configurationId || null,
      String(title || game.title).trim(),
           visibility === "private" ? "private" : "public",
           finalMaxPlayers
    );

    db.prepare(`
    INSERT INTO play_session_members (session_id, user_id, role)
    VALUES (?, ?, 'host')
    `).run(result.lastInsertRowid, user.id);

    db.prepare(`
    INSERT INTO play_session_state (session_id, state_json)
    VALUES (?, '{}')
    `).run(result.lastInsertRowid);

    return result.lastInsertRowid;
  });

  tx();
  res.json({ success: true, redirectUrl: `/play/session/${sessionKey}` });
});

router.get("/play/session/:sessionKey", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);

  const session = db.prepare(`
  SELECT s.*, g.title AS game_title, g.bgg_url,
  c.name AS configuration_name, c.layout_json,
  u.display_name, u.username
  FROM play_sessions s
  JOIN play_games g ON g.id = s.game_id
  LEFT JOIN play_game_configurations c ON c.id = s.configuration_id
  JOIN users u ON u.id = s.host_user_id
  WHERE s.session_key = ? AND s.status = 'active'
  `).get(req.params.sessionKey);

  if (!session) return res.status(404).send("Session not found");

  const hostIsFriend = db.prepare(`
  SELECT 1 FROM friendships WHERE user_id = ? AND friend_user_id = ?
  `).get(user.id, session.host_user_id);

  const member = db.prepare(`
  SELECT * FROM play_session_members WHERE session_id = ? AND user_id = ?
  `).get(session.id, user.id);

  const mayView =
  session.visibility === "public" ||
  session.host_user_id === user.id ||
  !!hostIsFriend ||
  !!member;

  if (!mayView) return res.status(403).send("Forbidden");

  if (!member) {
    if (session.current_players >= session.max_players) {
      return res.status(409).send("Session is full");
    }

    const joinTx = db.transaction(() => {
      db.prepare(`
      INSERT INTO play_session_members (session_id, user_id, role)
      VALUES (?, ?, 'player')
      `).run(session.id, user.id);

      db.prepare(`
      UPDATE play_sessions
      SET current_players = current_players + 1
      WHERE id = ?
      `).run(session.id);
    });

    joinTx();
  }

  const members = db.prepare(`
  SELECT u.id, u.username, u.display_name, m.role, m.joined_at
  FROM play_session_members m
  JOIN users u ON u.id = m.user_id
  WHERE m.session_id = ?
  ORDER BY CASE WHEN m.role = 'host' THEN 0 ELSE 1 END,
  COALESCE(u.display_name, u.username) COLLATE NOCASE
  `).all(session.id);

  const state = db.prepare(`
  SELECT state_json, updated_at FROM play_session_state WHERE session_id = ?
  `).get(session.id);

  res.render("play/session", {
    session,
    members,
    stateJson: state?.state_json || "{}",
    currentUser: user
  });
});

router.post("/api/play/sessions/:sessionId/state", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);

  const session = db.prepare(`
  SELECT * FROM play_sessions WHERE id = ? AND status = 'active'
  `).get(req.params.sessionId);

  if (!session) return res.status(404).json({ error: "Session not found" });

  const member = db.prepare(`
  SELECT * FROM play_session_members WHERE session_id = ? AND user_id = ?
  `).get(session.id, user.id);

  if (!member) return res.status(403).json({ error: "Forbidden" });

  const nextState = req.body.state;
  if (typeof nextState !== "object" || !nextState) {
    return res.status(400).json({ error: "Invalid state payload" });
  }

  db.prepare(`
  UPDATE play_session_state
  SET state_json = ?, updated_at = CURRENT_TIMESTAMP
  WHERE session_id = ?
  `).run(JSON.stringify(nextState), session.id);

  res.json({ success: true });
});

router.post("/api/play/sessions/:sessionId/terminate", requireLogin, requirePlayAccess, (req, res) => {
  const user = getUser(req);
  const { outcome } = req.body;

  const session = db.prepare(`
  SELECT * FROM play_sessions WHERE id = ? AND status = 'active'
  `).get(req.params.sessionId);

  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.host_user_id !== user.id) {
    return res.status(403).json({ error: "Only the host can terminate a session" });
  }

  db.prepare(`
  UPDATE play_sessions
  SET status = ?, ended_at = CURRENT_TIMESTAMP
  WHERE id = ?
  `).run(outcome === "completed" ? "completed" : "abandoned", session.id);

  db.prepare(`DELETE FROM play_session_state WHERE session_id = ?`).run(session.id);
  db.prepare(`DELETE FROM play_session_members WHERE session_id = ?`).run(session.id);

  res.json({ success: true, redirectUrl: "/play" });
});

module.exports = router;
