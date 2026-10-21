const User = require("../models/User");
const { verifyAccessToken } = require("../utils/authToken");

async function requireAuth(req, res, next) {
  res.set("Cache-Control", "no-store");

  const authorization = req.get("Authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }

  let payload;

  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    return res.status(401).json({
      message: "Your session is invalid or expired. Please log in again.",
    });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !/^[a-f0-9]{24}$/i.test(payload.sub) ||
    !Number.isInteger(payload.tokenVersion)
  ) {
    return res.status(401).json({
      message: "Invalid session. Please log in again.",
    });
  }

  try {
    const user = await User.findById(payload.sub)
      .select("name email role isVerified +tokenVersion");

    if (
      !user ||
      !user.isVerified ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      return res.status(401).json({
        message: "Please log in again.",
      });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  } catch (error) {
    console.error("Authentication:", error.message);

    return res.status(500).json({
      message: "Unable to check your session. Please try again.",
    });
  }

  next();
}

module.exports = requireAuth;