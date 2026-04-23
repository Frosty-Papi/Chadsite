const express = require("express");
const db = require("../db");
const { requireLogin, getUser, isRoleAtLeast } = require("../middleware/auth");

const router = express.Router();

function requirePlayAccess(req, res, next) {
    const user = getUser(req);
    if (!user) return res.redirect("/login");

    const service = db.prepare("SELECT * FROM services WHERE path = ? AND is_enabled = 1").get("/play");

    if (!service) {
        return res.status(404).send("Service not configured");
    }

    if (!isRoleAtLeast(user.role, service.min_role || "user")) {
        return res.status(403).send("Access denied");
    }

    next();
}

function normalizeTitle(value) {
    return String(value || "").trim().slice(0, 100);
}

router.get("/play", requireLogin, requirePlayAccess, (req, res) => {
    res.render("play");
});

router.get("/api/play/public-games", requireLogin, requirePlayAccess, (req, res) => {
    const user = getUser(req);

    const games = db.prepare(`
    SELECT
    gs.id,
    gs.title,
    gs.current_users,
    gs.max_users,
    u.username,
    u.display_name
    FROM game_sessions gs
    JOIN users u ON u.id = gs.host_user_id
    WHERE gs.status = 'open'
    AND gs.is_private = 0
    AND gs.host_user_id != ?
    ORDER BY gs.created_at DESC, gs.id DESC
    `).all(user.id);

    res.json({ success: true, games });
});

router.get("/api/play/private-games", requireLogin, requirePlayAccess, (req, res) => {
    const user = getUser(req);

    const games = db.prepare(`
    SELECT
    gs.id,
    gs.title,
    gs.current_users,
    gs.max_users,
    u.username,
    u.display_name
    FROM game_sessions gs
    JOIN users u ON u.id = gs.host_user_id
    JOIN friends f ON f.friend_id = gs.host_user_id
    WHERE f.user_id = ?
    AND gs.status = 'open'
    AND gs.is_private = 1
    ORDER BY gs.created_at DESC, gs.id DESC
    `).all(user.id);

    res.json({ success: true, games });
});

router.post("/api/play/sessions", requireLogin, requirePlayAccess, (req, res) => {
    const user = getUser(req);
    const title = normalizeTitle(req.body.title);
    const maxUsers = Number.parseInt(req.body.maxUsers, 10);
    const isPrivate = req.body.isPrivate ? 1 : 0;

    if (!title) {
        return res.status(400).json({ error: "Game title is required" });
    }

    if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > 64) {
        return res.status(400).json({ error: "Max users must be between 1 and 64" });
    }

    const existingOpenSession = db.prepare(`
    SELECT id
    FROM game_sessions
    WHERE host_user_id = ?
    AND status = 'open'
    ORDER BY id DESC
    LIMIT 1
    `).get(user.id);

    if (existingOpenSession) {
        return res.status(409).json({ error: "You already have an open game session" });
    }

    const result = db.prepare(`
    INSERT INTO game_sessions (
        title,
        host_user_id,
        is_private,
        current_users,
        max_users,
        status,
        created_at,
        updated_at
    )
    VALUES (?, ?, ?, 1, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(title, user.id, isPrivate, maxUsers);

    res.json({ success: true, sessionId: result.lastInsertRowid });
});

module.exports = router;
