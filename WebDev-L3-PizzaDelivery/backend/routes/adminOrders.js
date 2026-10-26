const express = require("express");
const Order = require("../models/Order");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function serializeOrder(order) {
  return {
    id: order._id.toString(),
    customer: order.user
      ? {
          name: order.user.name,
          email: order.user.email,
        }
      : null,
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
    updatedAt: order.updatedAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({
      paymentStatus: "paid",
      stockDeducted: true,
    })
      .select(
        "user items currency totalMinor paymentStatus status createdAt updatedAt"
      )
      .populate("user", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      orders: orders.map(serializeOrder),
    });
  } catch (error) {
    console.error("Load admin orders:", error.message);

    return res.status(500).json({
      message: "Unable to load orders. Please try again.",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { expectedStatus, status } = req.body || {};

    if (!/^[a-f0-9]{24}$/i.test(id)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const validTransition =
      (expectedStatus === "order_received" &&
        status === "in_kitchen") ||
      (expectedStatus === "in_kitchen" &&
        status === "sent_to_delivery");

    if (!validTransition) {
      return res.status(400).json({
        message:
          "Use the next order status: In kitchen, then Sent to delivery.",
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        paymentStatus: "paid",
        stockDeducted: true,
        status: expectedStatus,
      },
      {
        $set: { status },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    )
      .select(
        "user items currency totalMinor paymentStatus status createdAt updatedAt"
      )
      .populate("user", "name email")
      .lean();

    if (!order) {
      const exists = await Order.exists({ _id: id });

      return res.status(exists ? 409 : 404).json({
        message: exists
          ? "The order changed or is not ready for preparation. Refresh orders."
          : "Order not found.",
      });
    }

    return res.status(200).json({
      message: "Order status updated successfully.",
      order: serializeOrder(order),
    });
  } catch (error) {
    console.error("Update order status:", error.message);

    return res.status(500).json({
      message: "Unable to update the order. Please refresh orders.",
    });
  }
});

module.exports = router;