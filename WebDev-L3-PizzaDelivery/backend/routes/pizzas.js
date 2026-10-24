const express = require("express");
const Pizza = require("../models/Pizza");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const pizzas = await Pizza.find({ isActive: true })
      .select("_id slug name description")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      pizzas: pizzas.map((pizza) => ({
        id: pizza._id.toString(),
        slug: pizza.slug,
        name: pizza.name,
        description: pizza.description,
      })),
    });
  } catch (error) {
    console.error("Load pizzas:", error.message);

    return res.status(500).json({
      message: "Unable to load pizzas. Please try again.",
    });
  }
});

module.exports = router;