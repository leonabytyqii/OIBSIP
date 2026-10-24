const express = require("express");
const Ingredient = require("../models/Ingredient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const ingredients = await Ingredient.find({
      isActive: true,
    })
      .select("_id name category stock")
      .sort({ category: 1, name: 1 })
      .lean();

    return res.status(200).json({
      ingredients: ingredients.map((ingredient) => ({
        id: ingredient._id.toString(),
        name: ingredient.name,
        category: ingredient.category,
        available: ingredient.stock > 0,
      })),
    });
  } catch (error) {
    console.error("Load ingredients:", error.message);

    return res.status(500).json({
      message: "Unable to load ingredients. Please try again.",
    });
  }
});

module.exports = router;