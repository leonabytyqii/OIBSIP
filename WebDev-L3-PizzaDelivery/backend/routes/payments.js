const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const requireAuth = require("../middleware/requireAuth");
const {
  getRazorpayClient,
  getRazorpayKeyId,
} = require("../utils/razorpay");

const router = express.Router();

router.use(requireAuth);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
}));

function fail(status, message) {
  const error = new Error(message);
  error.httpStatus = status;
  throw error;
}

function isGatewayId(value, prefix) {
  return (
    typeof value === "string" &&
    value.length <= 100 &&
    new RegExp(`^${prefix}_[a-zA-Z0-9]+$`).test(value)
  );
}

function configuration() {
  const keyId = getRazorpayKeyId();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId.startsWith("rzp_test_") || !secret) {
    fail(503, "Configure Razorpay TEST keys in backend/.env.");
  }

  return {
    keyId,
    secret,
    client: getRazorpayClient(),
  };
}

async function ownedOrder(orderId, userId) {
  if (
    typeof orderId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(orderId)
  ) {
    fail(400, "Invalid order ID.");
  }

  await Order.init();

  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  }).lean();

  if (!order) {
    fail(404, "Order not found.");
  }

  return order;
}

function summary(order) {
  return {
    id: order._id.toString(),
    items: order.items.map(({ name, category, priceMinor }) => ({
      name,
      category,
      priceMinor,
    })),
    currency: order.currency,
    totalMinor: order.totalMinor,
    paymentStatus: order.paymentStatus,
    status: order.status,
    stockDeducted: order.stockDeducted,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

function validAmount(order) {
  if (
    order.currency !== "EUR" ||
    !Number.isSafeInteger(order.totalMinor) ||
    order.totalMinor <= 0
  ) {
    fail(409, "Invalid order amount or currency.");
  }
}

async function inventory(order, session = null) {
  const requirements = new Map();

  if (
    !Array.isArray(order.items) ||
    order.items.length < 3 ||
    order.items.length > 23
  ) {
    fail(409, "Invalid order ingredients.");
  }

  for (const item of order.items) {
    const id = item.ingredient?.toString();

    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      fail(409, "Invalid order ingredient.");
    }

    const previous = requirements.get(id);

    if (previous && previous.category !== item.category) {
      fail(409, "Invalid ingredient category.");
    }

    requirements.set(id, {
      id,
      category: item.category,
      quantity: (previous?.quantity || 0) + 1,
    });
  }

  const rows = [...requirements.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const ingredients = await Ingredient.find({
    _id: { $in: rows.map((item) => item.id) },
  })
    .select("_id category stock isActive")
    .session(session)
    .lean();

  const byId = new Map(
    ingredients.map((item) => [item._id.toString(), item])
  );

  const available = rows.every((item) => {
    const ingredient = byId.get(item.id);

    return (
      ingredient &&
      ingredient.isActive === true &&
      ingredient.category === item.category &&
      Number.isSafeInteger(ingredient.stock) &&
      ingredient.stock >= item.quantity
    );
  });

  return { rows, available };
}

function checkPayment(order, payment) {
  validAmount(order);

  if (
    !isGatewayId(payment.id, "pay") ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== order.totalMinor ||
    payment.currency !== order.currency ||
    payment.amount_refunded !== 0
  ) {
    fail(
      409,
      "Payment details do not match this order, or it was refunded."
    );
  }
}

async function completeOrder(orderId, userId, payment) {
  return mongoose.connection.transaction(
    async (session) => {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
      })
        .session(session)
        .lean();

      if (!order) {
        fail(404, "Order not found.");
      }

      checkPayment(order, payment);

      if (
        order.razorpayPaymentId &&
        order.razorpayPaymentId !== payment.id
      ) {
        fail(
          409,
          "Another payment is already linked to this order."
        );
      }

      if (
        order.paymentStatus === "paid" &&
        order.stockDeducted
      ) {
        return { order, requiresReview: false };
      }

      if (
        order.stockDeducted ||
        !["pending", "paid"].includes(order.paymentStatus) ||
        !["awaiting_payment", "payment_review"].includes(order.status)
      ) {
        fail(409, "This order cannot be processed.");
      }

      const { rows, available } = await inventory(order, session);

      if (available) {
        for (const item of rows) {
          const result = await Ingredient.updateOne(
            {
              _id: item.id,
              category: item.category,
              isActive: true,
              stock: { $gte: item.quantity },
            },
            {
              $inc: { stock: -item.quantity },
            },
            { session }
          );

          if (result.modifiedCount !== 1) {
            fail(
              409,
              "Inventory changed. Check payment status again; do not pay again."
            );
          }
        }
      }

      const updated = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: userId,
          razorpayOrderId: payment.order_id,
          stockDeducted: false,
          paymentStatus: { $in: ["pending", "paid"] },
          status: {
            $in: ["awaiting_payment", "payment_review"],
          },
        },
        {
          $set: {
            razorpayPaymentId: payment.id,
            paymentStatus: "paid",
            paidAt: order.paidAt || new Date(),
            stockDeducted: available,
            status: available
              ? "order_received"
              : "payment_review",
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      ).lean();

      if (!updated) {
        fail(409, "Order changed. Check payment status again.");
      }

      return {
        order: updated,
        requiresReview: !available,
      };
    },
    {
      readPreference: "primary",
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    }
  );
}

async function finish(res, order, userId, payment) {
  checkPayment(order, payment);

  if (
    payment.status !== "captured" ||
    payment.captured !== true
  ) {
    return res.status(202).json({
      verified: false,
      message:
        "Payment is not captured yet. Check its status again; do not pay again.",
    });
  }

  const result = await completeOrder(
    order._id,
    userId,
    payment
  );

  return res.status(200).json({
    verified: true,
    requiresReview: result.requiresReview,
    message: result.requiresReview
      ? "Payment received, but ingredients are unavailable. Contact the administrator; do not pay again."
      : "Payment verified and order confirmed.",
    order: summary(result.order),
  });
}

function report(res, error, operation) {
  console.error(
    operation,
    error.error?.description || error.message || "Unknown error"
  );

  return res.status(error.httpStatus || 502).json({
    message: error.httpStatus
      ? error.message
      : "Unable to confirm the payment operation. Check payment status before trying another payment.",
  });
}

router.post("/create", async (req, res) => {
  try {
    const { client, keyId } = configuration();

    let order = await ownedOrder(
      req.body?.orderId,
      req.user.id
    );

    validAmount(order);

    if (
      order.paymentStatus !== "pending" ||
      order.status !== "awaiting_payment" ||
      order.stockDeducted
    ) {
      fail(
        409,
        "This order cannot accept another payment. Check payment status."
      );
    }

    const { available } = await inventory(order);

    if (!available) {
      fail(
        409,
        "Some ingredients are unavailable. Please edit your selection."
      );
    }

    let gatewayOrder;

    if (order.razorpayOrderId) {
      gatewayOrder = await client.orders.fetch(
        order.razorpayOrderId
      );
    } else {
      gatewayOrder = await client.orders.create({
        amount: order.totalMinor,
        currency: order.currency,
        receipt: `pizza_${order._id}_${crypto.randomBytes(3).toString("hex")}`,
        partial_payment: false,
        notes: {
          localOrderId: order._id.toString(),
        },
      });

      if (
        !isGatewayId(gatewayOrder.id, "order") ||
        gatewayOrder.amount !== order.totalMinor ||
        gatewayOrder.currency !== order.currency
      ) {
        fail(502, "Razorpay returned an unexpected order.");
      }

      const linked = await Order.findOneAndUpdate(
        {
          _id: order._id,
          user: req.user.id,
          paymentStatus: "pending",
          status: "awaiting_payment",
          stockDeducted: false,
          razorpayOrderId: null,
        },
        {
          $set: {
            razorpayOrderId: gatewayOrder.id,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();

      if (linked) {
        order = linked;
      } else {
        order = await ownedOrder(
          req.body?.orderId,
          req.user.id
        );

        if (
          order.paymentStatus !== "pending" ||
          !order.razorpayOrderId
        ) {
          fail(409, "Order changed. Check payment status.");
        }

        gatewayOrder = await client.orders.fetch(
          order.razorpayOrderId
        );
      }
    }

    if (
      gatewayOrder.id !== order.razorpayOrderId ||
      gatewayOrder.amount !== order.totalMinor ||
      gatewayOrder.currency !== order.currency
    ) {
      fail(
        409,
        "Razorpay order does not match the saved order."
      );
    }

    if (!["created", "attempted"].includes(gatewayOrder.status)) {
      fail(
        409,
        "A payment may already be completed. Check payment status; do not pay again."
      );
    }

    return res.status(200).json({
      keyId,
      razorpayOrderId: order.razorpayOrderId,
      orderId: order._id.toString(),
      amount: order.totalMinor,
      currency: order.currency,
    });
  } catch (error) {
    return report(res, error, "Create Razorpay payment:");
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { client, secret } = configuration();

    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body || {};

    if (
      !isGatewayId(razorpayOrderId, "order") ||
      !isGatewayId(razorpayPaymentId, "pay") ||
      typeof razorpaySignature !== "string" ||
      !/^[a-f0-9]{64}$/.test(razorpaySignature)
    ) {
      fail(400, "Invalid payment response.");
    }

    const order = await ownedOrder(orderId, req.user.id);

    if (order.razorpayOrderId !== razorpayOrderId) {
      fail(400, "Payment belongs to a different order.");
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${order.razorpayOrderId}|${razorpayPaymentId}`)
      .digest();

    if (
      !crypto.timingSafeEqual(
        expected,
        Buffer.from(razorpaySignature, "hex")
      )
    ) {
      fail(400, "Payment signature is invalid.");
    }

    const payment = await client.payments.fetch(
      razorpayPaymentId
    );

    if (payment.id !== razorpayPaymentId) {
      fail(502, "Unexpected payment response.");
    }

    return await finish(res, order, req.user.id, payment);
  } catch (error) {
    return report(res, error, "Verify Razorpay payment:");
  }
});

router.post("/check", async (req, res) => {
  try {
    const { client } = configuration();

    const order = await ownedOrder(
      req.body?.orderId,
      req.user.id
    );

    if (!isGatewayId(order.razorpayOrderId, "order")) {
      return res.status(200).json({
        verified: false,
        canRetry: true,
        message:
          "Payment has not been started. You can use the Pay button.",
      });
    }

    const result = await client.orders.fetchPayments(
      order.razorpayOrderId
    );

    if (!Array.isArray(result.items)) {
      fail(502, "Invalid payment status response.");
    }

    const payment = result.items.find(
      (item) => item.status === "captured"
    );

    if (!payment) {
      if (
        result.items.some((item) => item.status === "refunded")
      ) {
        fail(
          409,
          "The payment was refunded. Contact the administrator."
        );
      }

      const gatewayOrder = await client.orders.fetch(
        order.razorpayOrderId
      );

      const processing =
        gatewayOrder.status === "paid" ||
        result.items.some((item) =>
          ["created", "authorized"].includes(item.status)
        );

      return res.status(processing ? 202 : 200).json({
        verified: false,
        canRetry: !processing,
        message: processing
          ? "Payment is still processing. Check again shortly; do not pay again."
          : "No completed payment found. You can try the Pay button again.",
      });
    }

    return await finish(res, order, req.user.id, payment);
  } catch (error) {
    return report(res, error, "Check Razorpay payment:");
  }
});

module.exports = router;