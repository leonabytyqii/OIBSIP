const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
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
        message: "Price must be a whole number in minor units.",
      },
    },
    stock: {
        
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Stock must be a whole number.",
      },
    },

    lowStockThreshold: {
      type: Number,
      default: 20,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Low stock threshold must be a whole number.",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Ingredient", ingredientSchema);