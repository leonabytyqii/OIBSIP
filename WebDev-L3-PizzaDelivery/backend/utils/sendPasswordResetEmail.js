const User = require("../models/User");
const { createToken } = require("./tokens");
const { sendEmail } = require("./sendEmail");

async function sendPasswordResetEmail(user) {
  const { token, tokenHash } = createToken();

  const resetUrl = new URL(
    "/reset-password",
    process.env.CLIENT_URL || "http://localhost:5173"
  );

  resetUrl.searchParams.set("token", token);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(
          Date.now() + 30 * 60 * 1000
        ),
      },
    }
  );

  await sendEmail({
    to: user.email,
    subject: "Reset your Pizza Delivery password",
    text: [
      `Hello ${user.name},`,
      "",
      "Choose a new password using this link:",
      resetUrl.toString(),
      "",
      "This link expires in 30 minutes.",
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}

module.exports = { sendPasswordResetEmail };