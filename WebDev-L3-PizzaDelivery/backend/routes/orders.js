const express = require("express");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const requireAuth = require("../middleware/requireAuth");


const router = express.Router();
router.get("/my", requireAuth, async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const orders = await Order.find({
      user: req.user.id,
    })
      .select(
        "_id items currency totalMinor paymentStatus status createdAt paidAt"
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      orders: orders.map((order) => ({
        id: order._id.toString(),
        items: order.items.map((item) => ({
          name: item.name,
          category: item.category,
          priceMinor: item.priceMinor,
        })),
        currency: order.currency,
        totalMinor: order.totalMinor,
        paymentStatus: order.paymentStatus,
        status: order.status,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
      })),
    });
  } catch (error) {
    console.error("Load customer orders:", error.message);

    return res.status(500).json({
      message: "Unable to load your orders. Please try again.",
    });
  }
});

router.post("/quote", requireAuth, async (req, res) => {
  try {
    const { base, sauce, cheese, veggie = [] } = req.body || {};

    const validId = (value) =>
      typeof value === "string" && /^[a-f0-9]{24}$/.test(value);

    if (
      !validId(base) ||
      !validId(sauce) ||
      !validId(cheese) ||
      !Array.isArray(veggie) ||
      veggie.length > 20 ||
      !veggie.every(validId)
    ) {
      return res.status(400).json({
        message: "Please choose valid pizza ingredients.",
      });
    }

    const selections = [
      { id: base, category: "base" },
      { id: sauce, category: "sauce" },
      { id: cheese, category: "cheese" },
      ...veggie.map((id) => ({ id, category: "veggie" })),
    ];

    const ids = selections.map((item) => item.id);

    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({
        message: "An ingredient cannot be selected more than once.",
      });
    }

    const ingredients = await Ingredient.find({
      _id: { $in: ids },
      isActive: true,
    })
      .select("_id name category stock priceMinor")
      .lean();

    const byId = new Map(
      ingredients.map((item) => [item._id.toString(), item])
    );

    const items = [];

    for (const selected of selections) {
      const ingredient = byId.get(selected.id);

      if (!ingredient || ingredient.category !== selected.category) {
        return res.status(400).json({
          message: "An ingredient is unavailable or has the wrong category.",
        });
      }

      if (!Number.isSafeInteger(ingredient.stock) || ingredient.stock < 1) {
        return res.status(409).json({
          message: `${ingredient.name} is out of stock.`,
        });
      }

      if (
        !Number.isSafeInteger(ingredient.priceMinor) ||
        ingredient.priceMinor < 0 ||
        ingredient.priceMinor > 1000000
      ) {
        return res.status(503).json({
          message: "Ingredient pricing is unavailable. Please try again later.",
        });
      }

      items.push({
        id: ingredient._id.toString(),
        name: ingredient.name,
        category: ingredient.category,
        priceMinor: ingredient.priceMinor,
      });
    }

    const totalMinor = items.reduce(
      (total, item) => total + item.priceMinor,
      0
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      currency: "EUR",
      items,
      totalMinor,
    });
  } catch (error) {
    console.error("Pizza quote:", error.message);

    return res.status(500).json({
      message: "Unable to calculate the total. Please try again.",
    });
  }
});

module.exports = router;