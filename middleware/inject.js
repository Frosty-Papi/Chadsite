const db = require("../db");
const { getUser, isRoleAtLeast } = require("./auth");

module.exports = (req, res, next) => {
  const user = getUser(req);

  if (user) {
    const lastSeen = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
    if (!lastSeen || Date.now() - lastSeen > 60 * 1000) {
      db.prepare("UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
      user.last_seen_at = new Date().toISOString();
    }
  }

  res.locals.user = user;

  if (user) {
    const services = db.prepare("SELECT * FROM services WHERE is_enabled = 1 ORDER BY sort_order, name").all();
    res.locals.services = services.filter(s => isRoleAtLeast(user.role, s.min_role || "user"));
  } else {
    res.locals.services = [];
  }

  next();
};
