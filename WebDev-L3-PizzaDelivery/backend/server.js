const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(express.json());

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    message: "Pizza Delivery API is running",
    database: connected ? "connected" : "disconnected",
  });
});

async function startServer() {
  const { MONGO_URI, MONGO_USER, MONGO_PASSWORD } = process.env;

  if (!MONGO_URI || !MONGO_USER || !MONGO_PASSWORD) {
    throw new Error("Ploteso kredencialet te backend/.env");
  }

  await mongoose.connect(MONGO_URI, {
    user: MONGO_USER,
    pass: MONGO_PASSWORD,
    authSource: "admin",
    dbName: "pizza_delivery",
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected");

    app.listen(PORT, (error) => {
    if (error) {
      console.error("Gabim gjatë nisjes:", error.message);
      process.exit(1);
    }

    console.log(`Backend: http://localhost:${PORT}`);
  });
}
startServer().catch((error) => {
  console.error("MongoDB:", error.message);
  console.error("Node:", process.version);
  console.error("Mongoose:", mongoose.version);

  for (const [host, server] of error.reason?.servers || []) {
    console.error("Host:", host);
    console.error(
      "Detaji:",
      server.error?.message || "Pa detaje"
    );
  }

  process.exit(1);
});