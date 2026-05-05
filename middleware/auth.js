const db = require("../db");

const ROLE_ORDER = {
  user: 0,
  admin: 1,
  super_admin: 2
};

function isRoleAtLeast(role, min) {
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

function getUser(req) {
  if (req.user) return req.user;
  if (!req.session.userId) return null;

  req.user = db.prepare(`
    SELECT id, username, display_name, role, avatar,
           is_disabled, disabled_until, must_reset_password
    FROM users WHERE id = ?
  `).get(req.session.userId);
  return req.user;
}

function wantsJSON(req) {
  const accept = req.headers.accept || "";
  return accept.includes("application/json") || req.xhr;
}

function respondUnauthorized(req, res) {
  if (wantsJSON(req) || req.path.startsWith("/admin")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.redirect("/login");
}

function respondForbidden(req, res) {
  if (wantsJSON(req) || req.path.startsWith("/admin")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.status(403).send("Forbidden");
}

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAdminAccess(req, res, next) {
  const user = getUser(req);
  if (!user || !isRoleAtLeast(user.role, "admin")) {
    return respondForbidden(req, res);
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  const user = getUser(req);
  if (!user || user.role !== "super_admin") {
    return respondForbidden(req, res);
  }
  next();
}

function canActOnTarget(actor, target) {
  if (!target || target.role === "super_admin") return false;
  if (actor.role === "super_admin") return true;
  if (actor.role === "admin") return target.role === "user";
  return false;
}

function enforceAccountState(req, res, next) {
  if (!req.session.userId) return next();

  let user = getUser(req);
  if (!user) {
    req.session.destroy(() => {});
    return res.redirect("/login");
  }

  if (user.is_disabled) {
    if (user.disabled_until) {
      const until = new Date(user.disabled_until);
      if (until <= new Date()) {
        db.prepare(`UPDATE users SET is_disabled = 0, disabled_until = NULL, disable_reason = NULL WHERE id = ?`).run(user.id);
        user = getUser(req);
      } else {
        req.session.destroy(() => {});
        return res.redirect("/login?error=disabled");
      }
    } else {
      req.session.destroy(() => {});
      return res.redirect("/login?error=disabled");
    }
  }

  if (user.must_reset_password) {
    const allowed = ["/force-reset", "/logout"];
    if (!allowed.includes(req.path)) {
      return res.redirect("/force-reset");
    }
  }

  next();
}

module.exports = {
  getUser,
  requireLogin,
  requireAdminAccess,
  requireSuperAdmin,
  isRoleAtLeast,
  canActOnTarget,
  enforceAccountState
};
