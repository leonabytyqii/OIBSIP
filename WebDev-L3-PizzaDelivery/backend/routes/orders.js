const express = require("express");
const { rateLimit } = require("express-rate-limit");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
});

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readSelections(body) {
  const { base, sauce, cheese, veggie = [] } = body || {};

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
    throw requestError(
      400,
      "Please choose valid pizza ingredients."
    );
  }

  const selections = [
    { id: base, category: "base" },
    { id: sauce, category: "sauce" },
    { id: cheese, category: "cheese" },
    ...veggie.map((id) => ({ id, category: "veggie" })),
  ];

  const ids = selections.map((item) => item.id);

  if (new Set(ids).size !== ids.length) {
    throw requestError(
      400,
      "An ingredient cannot be selected more than once."
    );
  }

  return selections;
}

async function calculateQuote(selections) {
  const ingredients = await Ingredient.find({
    _id: { $in: selections.map((item) => item.id) },
    isActive: true,
  })
    .select("_id name category stock priceMinor")
    .lean();

  const byId = new Map(
    ingredients.map((item) => [item._id.toString(), item])
  );

  const items = selections.map((selected) => {
    const ingredient = byId.get(selected.id);

    if (!ingredient || ingredient.category !== selected.category) {
      throw requestError(
        400,
        "An ingredient is unavailable or has the wrong category."
      );
    }

    if (
      !Number.isSafeInteger(ingredient.stock) ||
      ingredient.stock < 1
    ) {
      throw requestError(
        409,
        `${ingredient.name} is out of stock.`
      );
    }

    if (
      !Number.isSafeInteger(ingredient.priceMinor) ||
      ingredient.priceMinor < 0 ||
      ingredient.priceMinor > 1000000
    ) {
      throw requestError(
        503,
        "Ingredient pricing is unavailable. Please try again later."
      );
    }

    return {
      id: ingredient._id.toString(),
      name: ingredient.name,
      category: ingredient.category,
      priceMinor: ingredient.priceMinor,
    };
  });

  return {
    currency: "EUR",
    items,
    totalMinor: items.reduce(
      (total, item) => total + item.priceMinor,
      0
    ),
  };
}

function serializeOrder(order) {
  return {
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
  };
}

function matchesSelection(order, selections) {
  const saved = order.items
    .map((item) => `${item.category}:${item.ingredient.toString()}`)
    .sort();

  const requested = selections
    .map((item) => `${item.category}:${item.id}`)
    .sort();

  return JSON.stringify(saved) === JSON.stringify(requested);
}

function replyWithExistingOrder(res, order, selections) {
  if (!matchesSelection(order, selections)) {
    return res.status(409).json({
      message:
        "This request ID was already used for another selection.",
    });
  }

  return res.status(200).json({
    message: "This order was already saved.",
    order: serializeOrder(order),
  });
}

router.get("/my", async (req, res) => {
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
      orders: orders.map(serializeOrder),
    });
  } catch (error) {
    console.error("Load customer orders:", error.message);

    return res.status(500).json({
      message: "Unable to load your orders. Please try again.",
    });
  }
});

router.post("/quote", async (req, res) => {
  try {
    const selections = readSelections(req.body);
    const quote = await calculateQuote(selections);

    return res.status(200).json(quote);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    console.error("Pizza quote:", error.message);

    return res.status(500).json({
      message: "Unable to calculate the total. Please try again.",
    });
  }
});

router.post("/", createOrderLimiter, async (req, res) => {
  let selections;
  let requestId;

  try {
    requestId = req.body?.requestId;

    if (
      typeof requestId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        requestId
      )
    ) {
      throw requestError(400, "A valid request ID is required.");
    }

    selections = readSelections(req.body);

    // Ensure the unique index is ready before creating orders.
    await Order.init();

    const existing = await Order.findOne({
      user: req.user.id,
      requestId,
    }).lean();

    if (existing) {
      return replyWithExistingOrder(res, existing, selections);
    }

    // Calculate prices using database values.
    const quote = await calculateQuote(selections);

    const expectedTotalMinor = req.body?.expectedTotalMinor;

    if (
      !Number.isSafeInteger(expectedTotalMinor) ||
      expectedTotalMinor < 0
    ) {
      throw requestError(
        400,
        "Please review the order total before continuing."
      );
    }

    if (expectedTotalMinor !== quote.totalMinor) {
      throw requestError(
        409,
        "Prices changed. Please review your selection again."
      );
    }

    const order = await Order.create({
      user: req.user.id,
      requestId,
      items: quote.items.map((item) => ({
        ingredient: item.id,
        name: item.name,
        category: item.category,
        priceMinor: item.priceMinor,
      })),
      currency: quote.currency,
      totalMinor: quote.totalMinor,
      paymentStatus: "pending",
      status: "awaiting_payment",
      paidAt: null,
      stockDeducted: false,
    });

    return res.status(201).json({
      message: "Order saved. Awaiting payment.",
      order: serializeOrder(order),
    });
  } catch (error) {
    // Two simultaneous requests may reach creation together.
    if (error.code === 11000 && requestId && selections) {
      try {
        const existing = await Order.findOne({
          user: req.user.id,
          requestId,
        }).lean();

        if (existing) {
          return replyWithExistingOrder(
            res,
            existing,
            selections
          );
        }
      } catch (lookupError) {
        console.error("Order lookup:", lookupError.message);
      }
    }

    if (error.status) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    console.error("Create order:", error.message);

    return res.status(500).json({
      message: "Unable to save your order. Please try again.",
    });
  }
});

module.exports = router;