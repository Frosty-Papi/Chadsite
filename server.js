const express = require("express");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "replace_this_with_a_long_random_secret",
  resave: false,
  saveUninitialized: false
}));

// View engine
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("view engine", "ejs");

// Static
app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads"));

// Inject user + services
const inject = require("./middleware/inject");
app.use(inject);

// Routes
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
