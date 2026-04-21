const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: "public/uploads/avatars",
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || ".png");
        cb(null, `avatar_${req.session.userId}_${Date.now()}${ext}`);
    }
});

const upload = multer({ storage });

router.post("/profile/update", requireLogin, upload.single("avatar"), (req, res) => {
    const user = getUser(req);
    const displayName = (req.body.display_name || "").trim();
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    if (avatarPath) {
        db.prepare(`
        UPDATE users
        SET display_name = ?, avatar = ?
        WHERE id = ?
        `).run(displayName || null, avatarPath, user.id);
    } else {
        db.prepare(`
        UPDATE users
        SET display_name = ?
        WHERE id = ?
        `).run(displayName || null, user.id);
    }

    res.redirect("/profile");
});
