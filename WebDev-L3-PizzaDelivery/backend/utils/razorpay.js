const Razorpay = require("razorpay");

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

function getRazorpayClient() {
  if (!keyId || !keySecret) {
    throw new Error(
      "Ploteso RAZORPAY_KEY_ID dhe RAZORPAY_KEY_SECRET ne backend/.env"
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function getRazorpayKeyId() {
  if (!keyId) {
    throw new Error("Mungon RAZORPAY_KEY_ID ne backend/.env");
  }

  return keyId;
}

module.exports = {
  getRazorpayClient,
  getRazorpayKeyId,
};