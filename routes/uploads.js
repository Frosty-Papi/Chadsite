const express = require("express");
const path = require("path");
const { requireLogin } = require("../middleware/auth");
const { AVATAR_DIR } = require("../lib/files");

const router = express.Router();

router.get("/uploads/avatars/:file", requireLogin, (req, res) => {
  const file = path.basename(req.params.file);
  const fullPath = path.join(AVATAR_DIR, file);

  if (!fullPath.startsWith(AVATAR_DIR)) {
    return res.status(400).send("Invalid path");
  }

  res.sendFile(fullPath);
});

module.exports = router;
