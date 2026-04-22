const fs = require("fs");
const path = require("path");
const db = require("../db");
const { AVATAR_DIR } = require("../lib/files");

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

async function cleanupOrphanAvatars() {
  let files;
  try {
    files = await fs.promises.readdir(AVATAR_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return;
    console.error("Failed to read avatar directory:", err);
    return;
  }

  const rows = db.prepare("SELECT avatar FROM users WHERE avatar IS NOT NULL").all();
  const referenced = new Set(
    rows
      .map(r => r.avatar)
      .filter(Boolean)
      .map(a => path.basename(a))
  );

  const now = Date.now();

  for (const file of files) {
    if (referenced.has(file)) continue;

    const fullPath = path.join(AVATAR_DIR, file);

    try {
      const stat = await fs.promises.stat(fullPath);

      if (now - stat.mtimeMs < GRACE_PERIOD_MS) continue;

      await fs.promises.unlink(fullPath);
      console.log("Deleted orphan avatar:", file);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Failed processing orphan avatar:", file, err);
      }
    }
  }
}

module.exports = { cleanupOrphanAvatars };
