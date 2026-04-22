const express = require("express");
const db = require("../db");
const { getUser, isRoleAtLeast } = require("../middleware/auth");

const router = express.Router();

function requireServiceAccess(path) {
  return (req, res, next) => {
    const user = getUser(req);
    if (!user) return res.redirect("/login");

    const service = db.prepare("SELECT * FROM services WHERE path = ? AND is_enabled = 1").get(path);

    if (!service) {
      return res.status(404).send("Service not configured");
    }

    if (!isRoleAtLeast(user.role, service.min_role || "user")) {
      return res.status(403).send("Access denied");
    }

    next();
  };
}

router.get("/deck", requireServiceAccess("/deck"), (req, res) => {
  res.render("deck");
});

module.exports = router;
