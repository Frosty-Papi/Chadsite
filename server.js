const express = require("express");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const { enforceAccountState } = require("./middleware/auth");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// Body limits
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// Basic CSRF protection via Origin check
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    const host = `${req.protocol}://${req.get("host")}`;
    if (origin && origin !== host) {
      return res.status(403).send("Forbidden");
    }
  }
  next();
});

// Rate limit login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Session secret
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

// View engine
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("view engine", "ejs");

// Static
app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads"));

// Enforce account state
app.use(enforceAccountState);

// Inject user + services
const inject = require("./middleware/inject");
app.use(inject);

// Routes
app.use("/login", loginLimiter);
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/profile"));
app.use("/", require("./routes/admin"));
app.use("/", require("./routes/services"));

// Home
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(3300, () => {
  console.log("ChadBroChill running on port 3300");
});
