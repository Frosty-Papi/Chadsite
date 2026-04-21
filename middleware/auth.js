const db = require("../db");

function getUser(req) {
    if (!req.session.userId) return null;

    return db.prepare(`
    SELECT id, username, display_name, role, avatar
    FROM users WHERE id = ?
    `).get(req.session.userId);
}

function requireLogin(req, res, next) {
    if (!req.session.userId) return res.redirect("/login");
    next();
}

function requireAdmin(req, res, next) {
    const user = getUser(req);
    if (!user || user.role !== "admin") {
        return res.status(403).send("Forbidden");
    }
    next();
}

module.exports = { getUser, requireLogin, requireAdmin };
