const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },

    name: {
      type: String,
      required: true,
      maxlength: 80,
    },

    category: {
      type: String,
      required: true,
      enum: ["base", "sauce", "cheese", "veggie", "meat"],
    },

    priceMinor: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000,
      validate: {
        validator: Number.isSafeInteger,
        message: "Price must be a whole number.",
      },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requestId: {
      type: String,
      maxlength: 36,
    },

    razorpayOrderId: {
      type: String,
      maxlength: 100,
      match: /^order_[a-zA-Z0-9]+$/,
    },

    razorpayPaymentId: {
      type: String,
      maxlength: 100,
      match: /^pay_[a-zA-Z0-9]+$/,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) &&
          items.length >= 3 &&
          items.length <= 23,
        message: "Please select valid pizza ingredients.",
      },
    },

    currency: {
      type: String,
      enum: ["EUR"],
      default: "EUR",
      required: true,
    },

    totalMinor: {
      type: Number,
      required: true,
      min: 0,
      max: 23000000,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total must be a whole number.",
      },
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "awaiting_payment",
        "payment_review",
        "order_received",
        "in_kitchen",
        "sent_to_delivery",
      ],
      default: "awaiting_payment",
      required: true,
    },

    adminArchivedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    stockDeducted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });

orderSchema.index(
  { user: 1, requestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestId: { $type: "string" },
    },
  }
);

orderSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string" },
    },
  }
);

orderSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Order", orderSchema);
