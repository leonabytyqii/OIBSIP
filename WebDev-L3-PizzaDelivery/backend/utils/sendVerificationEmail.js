const { createToken } = require("./tokens");
const { sendEmail } = require("./sendEmail");

async function sendVerificationEmail(user) {
  const { token, tokenHash } = createToken();

  const verificationUrl = new URL(
    "/verify-email",
    process.env.CLIENT_URL || "http://localhost:5173"
  );

  verificationUrl.searchParams.set("token", token);

  user.verificationTokenHash = tokenHash;
  user.verificationTokenExpiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  );

  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Verify your Pizza Delivery account",
    text: [
      `Hello ${user.name},`,
      "",
      "Verify your email address using this link:",
      verificationUrl.toString(),
      "",
      "This link expires in 24 hours.",
    ].join("\n"),
  });
}

module.exports = { sendVerificationEmail };