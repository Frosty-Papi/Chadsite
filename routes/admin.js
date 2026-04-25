const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAdminAccess, requireSuperAdmin, getUser, canActOnTarget } = require("../middleware/auth");
const { validatePassword, generateOneTimePassword } = require("../lib/passwords");
const { deleteAvatarFile } = require("../lib/files");

const router = express.Router();

function listUsers() {
  return db.prepare(`
    SELECT id, username, display_name, role, avatar,
           is_disabled, disabled_until, must_reset_password
    FROM users
    WHERE role != 'super_admin'
    ORDER BY username COLLATE NOCASE
  `).all();
}

function listServices() {
  return db.prepare("SELECT * FROM services ORDER BY sort_order, name").all();
}

function generateCompliantOneTimePassword(username) {
  for (let i = 0; i < 10; i += 1) {
    const password = generateOneTimePassword();
    if (!validatePassword(password, username)) return password;
  }

  throw new Error("Unable to generate a compliant one-time password");
}

router.get("/admin", requireAdminAccess, (req, res) => {
  const viewer = getUser(req);

  const users = listUsers();
  const services = viewer.role === "super_admin" ? listServices() : [];

  res.render("admin", {
    users,
    services,
    viewer,
    isSuperAdmin: viewer.role === "super_admin"
  });
});

// CREATE USER (super admin only)
router.post("/admin/user", requireSuperAdmin, (req, res) => {
  const username = String(req.body.username || "").trim();

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  let tempPassword;
  try {
    tempPassword = generateCompliantOneTimePassword(username);
  } catch (e) {
    return res.status(500).json({ error: "Generated password did not meet password policy" });
  }

  const hash = bcrypt.hashSync(tempPassword, 10);

  try {
    const result = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        must_reset_password,
        password_reset_token
      )
      VALUES (?, ?, 1, 1)
    `).run(username, hash);

    const user = db.prepare(`
      SELECT id, username, display_name, role, avatar,
             is_disabled, disabled_until, must_reset_password
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.json({
      success: true,
      user,
      password: tempPassword,
      message: "User created. Share this one-time password now; it will not be shown again."
    });
  } catch (e) {
    res.status(400).json({ error: "User already exists" });
  }
});

// DELETE USER (super admin only)
router.post("/admin/user/delete", requireSuperAdmin, (req, res) => {
  const { userId } = req.body;

  if (parseInt(userId) === req.session.userId) {
    return res.status(400).send("Cannot delete yourself");
  }

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!target || target.role === "super_admin") {
    return res.status(400).send("Invalid target");
  }

  if (target?.avatar) {
    deleteAvatarFile(target.avatar);
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  res.json({ success: true });
});

// ROLE CHANGE (super admin only)
router.post("/admin/user/role", requireSuperAdmin, (req, res) => {
  const { userId, role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!target || target.role === "super_admin") {
    return res.status(400).json({ error: "Invalid target" });
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  res.json({ success: true });
});

// DISABLE USER
router.post("/admin/user/disable", requireAdminAccess, (req, res) => {
  const actor = getUser(req);
  const { userId, mode, disabledUntil } = req.body;

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!canActOnTarget(actor, target)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let until = null;
  if (mode === "temporary" && disabledUntil) {
    until = new Date(disabledUntil).toISOString();
  }

  db.prepare(`UPDATE users SET is_disabled = 1, disabled_until = ?, disable_reason = NULL WHERE id = ?`)
    .run(until, userId);

  res.json({ success: true });
});

// ENABLE USER
router.post("/admin/user/enable", requireAdminAccess, (req, res) => {
  const actor = getUser(req);
  const { userId } = req.body;

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!canActOnTarget(actor, target)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare(`UPDATE users SET is_disabled = 0, disabled_until = NULL WHERE id = ?`).run(userId);

  res.json({ success: true });
});

// RESET PASSWORD (admin + super)
router.post("/admin/user/reset-password", requireAdminAccess, (req, res) => {
  const actor = getUser(req);
  const { userId } = req.body;

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!canActOnTarget(actor, target)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let temp;
  try {
    temp = generateCompliantOneTimePassword(target.username);
  } catch (e) {
    return res.status(500).json({ error: "Generated password did not meet password policy" });
  }

  const hash = bcrypt.hashSync(temp, 10);

  db.prepare(`UPDATE users SET password_hash = ?, must_reset_password = 1, password_reset_token = 1 WHERE id = ?`)
    .run(hash, userId);

  res.json({ success: true, password: temp });
});

// FORCE RESET
router.post("/admin/user/force-reset", requireAdminAccess, (req, res) => {
  const actor = getUser(req);
  const { userId } = req.body;

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  if (!canActOnTarget(actor, target)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare(`UPDATE users SET must_reset_password = 1 WHERE id = ?`).run(userId);

  res.json({ success: true });
});

// SERVICES (super admin only)
router.post("/admin/service", requireSuperAdmin, (req, res) => {
  const { name, path, icon, min_role } = req.body;
  let isExternal = false;

  try {
    const url = new URL(path);
    isExternal = url.protocol === "http:" || url.protocol === "https:";
  } catch {}

  const is_external = isExternal ? 1 : 0;

  if (!name || !path) {
    return;
  }

  if (!is_external && !/^\/[a-z0-9/_-]*$/i.test(path)) {
    return res.status(400).json({ error: "Invalid service path" });
  }

  const result = db.prepare(`
    INSERT INTO services (name, path, icon, is_external, min_role)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, path, icon || null, is_external ? 1 : 0, min_role || "user");

  const service = db.prepare("SELECT * FROM services WHERE id = ?").get(result.lastInsertRowid);

  res.json({ success: true, service });
});

router.post("/admin/service/update", requireSuperAdmin, (req, res) => {
  const { serviceId, name, path, min_role } = req.body;

  if (!serviceId || !name || !path) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.prepare(`
  UPDATE services
  SET name = ?, path = ?, min_role = ?
  WHERE id = ?
  `).run(name, path, min_role, serviceId);

  res.json({ success: true });
});

router.post("/admin/service/delete", requireSuperAdmin, (req, res) => {
  const { serviceId } = req.body;

  db.prepare("DELETE FROM services WHERE id = ?").run(serviceId);

  res.json({ success: true });
});

module.exports = router;
