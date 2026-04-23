const express = require("express");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");
const path = require("path");
const fs = require("fs");

const { enforceAccountState } = require("./middleware/auth");
const { cleanupOrphanAvatars } = require("./jobs/cleanupAvatars");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
          frameAncestors: ["'self'"]
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  }
}));

const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("view engine", "ejs");

app.use(express.static("public"));
app.use("/deck-assets", express.static(path.join(__dirname, "views", "deck")));
app.use(require("./routes/uploads"));

app.use(enforceAccountState);

const inject = require("./middleware/inject");
app.use(inject);

app.use("/login", loginLimiter);
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/profile"));
app.use("/", require("./routes/admin"));
app.use("/", require("./routes/play"));
app.use("/", require("./routes/services"));

app.get("/api/deck/battle-goals", (req, res) => {
  try {
    const dir = path.join(__dirname, "views", "deck", "data", "battle-goals");
    const files = fs.readdirSync(dir)
    .filter(name => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .filter(name => name !== "battlegoal-back.png")
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name: name.replace(/\.[^.]+$/, ""),
                  image: `battle-goals/${name}`
    }));
    res.json({ battleGoals: files });
  } catch (err) {
    console.error("Failed to list battle goals", err);
    res.status(500).json({ battleGoals: [] });
  }
});

app.get("/api/deck/class-icons", (req, res) => {
  try {
    const dataDir = path.join(__dirname, "views", "deck", "data");
    const classIcons = {};

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const m = entry.name.match(/^([a-z]{2})-back\.(png|jpg|jpeg|webp)$/i);
          if (m) {
            const code = m[1].toLowerCase();
            const rel = path.relative(dataDir, full).split(path.sep).join("/");
            if (!classIcons[code]) classIcons[code] = rel;
          }
        }
      }
    }

    walk(dataDir);
    res.json({ classIcons });
  } catch (err) {
    console.error("Failed to list class icons", err);
    res.status(500).json({ classIcons: {} });
  }
});

app.get("/deck-modern", (req, res) => {
  res.render("deck-modern");
});

app.get("/", (req, res) => {
  res.render("index");
});

cleanupOrphanAvatars().catch(console.error);
setInterval(() => {
  cleanupOrphanAvatars().catch(console.error);
}, 6 * 60 * 60 * 1000);

app.use((err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    if ((req.headers.accept || "").includes("application/json") || req.xhr) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }
    return res.status(403).render("login", {
      error: "Your session expired. Please refresh the page and try again."
    });
  }
  return next(err);
});

app.listen(3300, () => {
  console.log("ChadBroChill running on port 3300");
});
