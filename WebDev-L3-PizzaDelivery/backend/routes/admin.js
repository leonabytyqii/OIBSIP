const express = require("express");
const Ingredient = require("../models/Ingredient");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/ingredients", async (req, res) => {
  try {
    const ingredients = await Ingredient.find({})
      .select("name category stock lowStockThreshold priceMinor isActive")
      .sort({ category: 1, name: 1 })
      .lean();

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      currency: "EUR",
      ingredients: ingredients.map((ingredient) => ({
        id: ingredient._id.toString(),
        name: ingredient.name,
        category: ingredient.category,
        stock: ingredient.stock,
        lowStockThreshold: ingredient.lowStockThreshold,
        priceMinor: ingredient.priceMinor,
        isActive: ingredient.isActive,
        lowStock: ingredient.stock < ingredient.lowStockThreshold,
      })),
    });
  } catch (error) {
    console.error("Admin inventory:", error.message);

    return res.status(500).json({
      message: "Unable to load inventory. Please try again.",
    });
  }
});
router.patch("/ingredients/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, expectedStock } = req.body || {};

    if (!/^[a-f0-9]{24}$/i.test(id)) {
      return res.status(400).json({
        message: "Invalid ingredient ID.",
      });
    }

    if (
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      stock > 1000000
    ) {
      return res.status(400).json({
        message: "Stock must be a whole number from 0 to 1000000.",
      });
    }

    if (
      !Number.isSafeInteger(expectedStock) ||
      expectedStock < 0
    ) {
      return res.status(400).json({
        message: "Please reload inventory before updating stock.",
      });
    }

    const ingredient = await Ingredient.findOneAndUpdate(
      {
        _id: id,
        stock: expectedStock,
      },
      {
        $set: { stock },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )
      .select("name category stock lowStockThreshold priceMinor isActive")
      .lean();

    if (!ingredient) {
      const exists = await Ingredient.exists({ _id: id });

      return res.status(exists ? 409 : 404).json({
        message: exists
          ? "Stock changed. Reload inventory and try again."
          : "Ingredient not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      message: "Stock updated successfully.",
      ingredient: {
        id: ingredient._id.toString(),
        name: ingredient.name,
        category: ingredient.category,
        stock: ingredient.stock,
        lowStockThreshold: ingredient.lowStockThreshold,
        priceMinor: ingredient.priceMinor,
        isActive: ingredient.isActive,
        lowStock: ingredient.stock < ingredient.lowStockThreshold,
      },
    });
  } catch (error) {
    console.error("Stock update:", error.message);

    return res.status(500).json({
      message: "Unable to update stock. Please try again.",
    });
  }
});

module.exports = router;