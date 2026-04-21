const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/admin", requireAdmin, (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    const services = db.prepare("SELECT * FROM services").all();

    const userData = users.map(u => ({
        ...u,
        permissions: db.prepare(
            "SELECT service_id FROM permissions WHERE user_id = ?"
        ).all(u.id).map(p => p.service_id)
    }));

    res.render("admin", { users: userData, services });
});

router.post("/admin/user", requireAdmin, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const hash = bcrypt.hashSync(password, 10);

    try {
        const result = db.prepare(`
        INSERT INTO users (username, password_hash)
        VALUES (?, ?)
        `).run(username, hash);

        const newUser = db.prepare(`
        SELECT * FROM users WHERE id = ?
        `).get(result.lastInsertRowid);

        res.json({ success: true, user: newUser });

    } catch (e) {
        res.status(400).json({ error: "User already exists" });
    }
});

// Delete user
router.post("/admin/user/delete", requireAdmin, (req, res) => {
    const { userId } = req.body;

    if (parseInt(userId) === req.session.userId) {
        return res.status(400).send("Cannot delete yourself");
    }

    db.prepare("DELETE FROM permissions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);

    res.json({ success: true });
});

router.post("/admin/service", requireAdmin, (req, res) => {
    const { name, path, icon, is_external } = req.body;

    if (!name || !path) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const result = db.prepare(`
    INSERT INTO services (name, path, icon, is_external)
    VALUES (?, ?, ?, ?)
    `).run(name, path, icon || null, is_external ? 1 : 0);

    const service = db.prepare(`
    SELECT * FROM services WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, service });
});

router.post("/admin/user/role", requireAdmin, (req, res) => {
    const { userId, role } = req.body;
    if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
    res.json({ success: true });
});

router.post("/admin/permission", requireAdmin, (req, res) => {
    const { userId, serviceId, allowed } = req.body;

    if (allowed) {
        db.prepare(`
        INSERT OR IGNORE INTO permissions (user_id, service_id)
        VALUES (?, ?)
        `).run(userId, serviceId);
    } else {
        db.prepare(`
        DELETE FROM permissions
        WHERE user_id = ? AND service_id = ?
        `).run(userId, serviceId);
    }

    res.json({ success: true });
});

router.post("/admin/service/update", requireAdmin, (req, res) => {
    const { id, name, path, icon, is_external } = req.body;

    db.prepare(`
    UPDATE services
    SET name = ?, path = ?, icon = ?, is_external = ?
    WHERE id = ?
    `).run(name, path, icon || null, is_external ? 1 : 0, id);

    res.json({ success: true });
});

router.post("/admin/service/delete", requireAdmin, (req, res) => {
    const { serviceId } = req.body;

    db.prepare("DELETE FROM permissions WHERE service_id = ?").run(serviceId);
    db.prepare("DELETE FROM services WHERE id = ?").run(serviceId);

    res.json({ success: true });
});

module.exports = router;
