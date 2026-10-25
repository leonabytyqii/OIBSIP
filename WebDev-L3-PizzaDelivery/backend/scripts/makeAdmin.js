const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const validator = require("validator");
const User = require("../models/User");

async function makeAdmin() {
  const email = (process.argv[2] || "").trim().toLowerCase();

  if (!validator.isEmail(email)) {
    throw new Error("Shkruaje emailin e llogarise pas komandes.");
  }

  const { MONGO_URI, MONGO_USER, MONGO_PASSWORD } = process.env;

  if (!MONGO_URI || !MONGO_USER || !MONGO_PASSWORD) {
    throw new Error("Mungojne kredencialet ne backend/.env.");
  }

  await mongoose.connect(MONGO_URI, {
    user: MONGO_USER,
    pass: MONGO_PASSWORD,
    authSource: "admin",
    dbName: "pizza_delivery",
    serverSelectionTimeoutMS: 10000,
  });

  const user = await User.findOne({ email })
    .select("email role isVerified");

  if (!user) {
    throw new Error("Nuk u gjet llogari me kete email.");
  }

  if (!user.isVerified) {
    throw new Error("Verifikoje emailin para se ta besh admin.");
  }

  if (user.role === "admin") {
    console.log("Kjo llogari eshte tashme admin.");
    return;
  }

  const result = await User.updateOne(
    {
      _id: user._id,
      role: "user",
      isVerified: true,
    },
    {
      $set: { role: "admin" },
      $inc: { tokenVersion: 1 },
    },
    { runValidators: true }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("Roli nuk u ndryshua. Provoje perseri.");
  }

  console.log("Llogaria u be admin me sukses.");
  console.log("Hyr perseri ne aplikacion me kete llogari.");
}

makeAdmin()
  .catch((error) => {
    console.error("Gabim:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });