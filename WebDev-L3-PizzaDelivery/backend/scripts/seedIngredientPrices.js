const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");
const Ingredient = require("../models/Ingredient");

const prices = [
  ["base-classic", 300],
  ["base-thin-crust", 350],
  ["base-thick-crust", 400],
  ["base-whole-wheat", 400],
  ["base-gluten-free", 450],

  ["sauce-tomato", 50],
  ["sauce-bbq", 70],
  ["sauce-pesto", 100],
  ["sauce-garlic-cream", 80],
  ["sauce-spicy-tomato", 70],

  ["cheese-mozzarella", 100],
  ["cheese-cheddar", 120],
  ["cheese-parmesan", 150],

  ["veggie-mushrooms", 70],
  ["veggie-peppers", 50],
  ["veggie-onions", 30],
  ["veggie-olives", 70],
  ["veggie-sweet-corn", 50],
  ["veggie-tomatoes", 40],
];
async function seedIngredientPrices() {
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

    let added = 0;

    for (const [slug, priceMinor] of prices) {
      const ingredient = await Ingredient.exists({ slug });

      if (!ingredient) {
        throw new Error(`Ingredient not found: ${slug}`);
      }

      const result = await Ingredient.updateOne(
        { slug },
        {
          $set: { priceMinor },
        },
        {
          runValidators: true,
        }
      );

      added += result.modifiedCount;
    }

    console.log(`Price setup complete. Added: ${added}`);
  } catch (error) {
    console.error("Price setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedIngredientPrices();