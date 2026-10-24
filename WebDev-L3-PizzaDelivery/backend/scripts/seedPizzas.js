const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");
const Pizza = require("../models/Pizza");

const pizzas = [
  {
    slug: "margherita",
    name: "Margherita",
    description: "Tomato sauce, mozzarella and fresh basil.",
    isActive: true,
  },
  {
    slug: "veggie",
    name: "Veggie",
    description:
      "Tomato sauce, mozzarella, peppers, mushrooms and olives.",
    isActive: true,
  },
  {
    slug: "pepperoni",
    name: "Pepperoni",
    description: "Tomato sauce, mozzarella and pepperoni.",
    isActive: true,
  },
];

async function seedPizzas() {
  try {
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

    await Pizza.init();

    let added = 0;

    for (const pizza of pizzas) {
      const result = await Pizza.updateOne(
        { slug: pizza.slug },
        { $setOnInsert: pizza },
        {
          upsert: true,
          runValidators: true,
          timestamps: false,
        }
      );

      added += result.upsertedCount;
    }

    console.log(`Pizza setup complete. Added: ${added}`);
  } catch (error) {
    console.error("Pizza setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedPizzas();