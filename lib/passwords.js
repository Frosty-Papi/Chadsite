const crypto = require("crypto");

const MIN_PASSWORD_LENGTH = 12;

function validatePassword(password, username = "") {
  if (typeof password !== "string") return "Invalid password.";

  const trimmed = password.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (!/[a-z]/.test(trimmed)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(trimmed)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[0-9]/.test(trimmed)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(trimmed)) {
    return "Password must include at least one special character.";
  }

  if (username && trimmed.toLowerCase().includes(String(username).toLowerCase())) {
    return "Password cannot contain the username.";
  }

  return null;
}

function generateOneTimePassword() {
  return [
    crypto.randomBytes(4).toString("hex").toUpperCase(),
    crypto.randomBytes(3).toString("base64url"),
    "!9aA"
  ].join("-");
}

function passwordRulesText() {
  return `At least ${MIN_PASSWORD_LENGTH} characters, with uppercase, lowercase, number, and special character.`;
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  validatePassword,
  generateOneTimePassword,
  passwordRulesText
};
