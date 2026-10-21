const jwt = require("jsonwebtoken");

const secret = process.env.JWT_SECRET;

if (!secret || !/^[a-f0-9]{96}$/.test(secret)) {
  throw new Error("Kontrollo JWT_SECRET te backend/.env");
}

const issuer = "pizza-delivery-api";
const audience = "pizza-delivery-client";

function createAccessToken(user) {
  if (!Number.isInteger(user.tokenVersion)) {
    throw new Error("Mungon tokenVersion i perdoruesit");
  }

  return jwt.sign(
    { tokenVersion: user.tokenVersion },
    secret,
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer,
      audience,
      expiresIn: "1h",
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer,
    audience,
    maxAge: "1h",
  });
}

module.exports = {
  createAccessToken,
  verifyAccessToken,
};