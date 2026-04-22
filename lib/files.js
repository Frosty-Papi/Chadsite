const fs = require("fs");
const path = require("path");

const AVATAR_DIR = path.join(__dirname, "..", "storage", "avatars");

function ensureAvatarDir() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

function isLocalAvatarPath(avatarPath) {
  return typeof avatarPath === "string" && avatarPath.startsWith("/uploads/avatars/");
}

function avatarPathToDiskPath(avatarPath) {
  if (!isLocalAvatarPath(avatarPath)) return null;

  const filename = path.basename(avatarPath);
  const diskPath = path.join(AVATAR_DIR, filename);

  if (!diskPath.startsWith(AVATAR_DIR)) return null;
  return diskPath;
}

function deleteAvatarFile(avatarPath) {
  const diskPath = avatarPathToDiskPath(avatarPath);
  if (!diskPath) return;

  fs.promises.unlink(diskPath).catch((err) => {
    if (err.code !== "ENOENT") {
      console.error("Failed to delete avatar file:", diskPath, err);
    }
  });
}

module.exports = {
  AVATAR_DIR,
  ensureAvatarDir,
  isLocalAvatarPath,
  avatarPathToDiskPath,
  deleteAvatarFile
};
