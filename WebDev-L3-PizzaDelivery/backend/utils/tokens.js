const crypto = require("node:crypto");

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createToken() {
  const token = crypto.randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashToken(token),
  };
}

module.exports = { createToken, hashToken }; 