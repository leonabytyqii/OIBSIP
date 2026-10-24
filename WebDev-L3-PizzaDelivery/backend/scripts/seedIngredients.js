const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");
const Ingredient = require("../models/Ingredient");

const ingredients = [
  // 5 baza
  { name: "Classic", slug: "base-classic", category: "base" },
  { name: "Thin Crust", slug: "base-thin-crust", category: "base" },
  { name: "Thick Crust", slug: "base-thick-crust", category: "base" },
  { name: "Whole Wheat", slug: "base-whole-wheat", category: "base" },
  { name: "Gluten Free", slug: "base-gluten-free", category: "base" },

  // 5 salca
  { name: "Tomato", slug: "sauce-tomato", category: "sauce" },
  { name: "BBQ", slug: "sauce-bbq", category: "sauce" },
  { name: "Pesto", slug: "sauce-pesto", category: "sauce" },
  { name: "Garlic Cream", slug: "sauce-garlic-cream", category: "sauce" },
  { name: "Spicy Tomato", slug: "sauce-spicy-tomato", category: "sauce" },

  // Djathëra
  { name: "Mozzarella", slug: "cheese-mozzarella", category: "cheese" },
  { name: "Cheddar", slug: "cheese-cheddar", category: "cheese" },
  { name: "Parmesan", slug: "cheese-parmesan", category: "cheese" },

  // Perime
  { name: "Mushrooms", slug: "veggie-mushrooms", category: "veggie" },
  { name: "Peppers", slug: "veggie-peppers", category: "veggie" },
  { name: "Onions", slug: "veggie-onions", category: "veggie" },
  { name: "Olives", slug: "veggie-olives", category: "veggie" },
  { name: "Sweet Corn", slug: "veggie-sweet-corn", category: "veggie" },
  { name: "Tomatoes", slug: "veggie-tomatoes", category: "veggie" },
];

async function seedIngredients() {
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

    await Ingredient.init();

    let added = 0;

    for (const ingredient of ingredients) {
      const exists = await Ingredient.exists({
        slug: ingredient.slug,
      });

      if (exists) {
        continue;
      }

      await Ingredient.create({
        ...ingredient,
        stock: 50,
        lowStockThreshold: 20,
        isActive: true,
      });

      added += 1;
    }

    console.log(`Ingredient setup complete. Added: ${added}`);
  } catch (error) {
    console.error("Ingredient setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedIngredients();