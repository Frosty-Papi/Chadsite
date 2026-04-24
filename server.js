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

app.use(helmet());
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Serve CropperJS locally
app.use("/vendor/cropperjs", express.static(path.join(__dirname, "node_modules", "cropperjs", "dist")));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }
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
app.use("/", require("./routes/services"));
app.use("/", require("./routes/friends"));
app.use("/", require("./routes/play"));

app.get("/deck-modern", (req, res) => res.render("deck-modern"));
app.get("/", (req, res) => res.render("index"));

app.listen(3300, () => console.log("ChadBroChill running on port 3300"));
