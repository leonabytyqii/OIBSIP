const nodemailer = require("nodemailer");

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

if (!gmailUser || !gmailPassword) {
  throw new Error(
    "Ploteso GMAIL_USER dhe GMAIL_APP_PASSWORD te backend/.env"
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUser,
    pass: gmailPassword,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

function verifyEmailConnection() {
  return transporter.verify();
}

function sendEmail({ to, subject, text }) {
  return transporter.sendMail({
    from: {
      name: "Pizza Delivery",
      address: gmailUser,
    },
    to,
    subject,
    text,
  });
}

module.exports = { sendEmail, verifyEmailConnection };