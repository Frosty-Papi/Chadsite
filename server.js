const express = require("express");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");

const { enforceAccountState } = require("./middleware/auth");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
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
app.use("/uploads", express.static("public/uploads"));

app.use(enforceAccountState);

const inject = require("./middleware/inject");
app.use(inject);

app.use("/login", loginLimiter);
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/profile"));
app.use("/", require("./routes/admin"));
app.use("/", require("./routes/services"));

app.get("/", (req, res) => {
  res.render("index");
});

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
