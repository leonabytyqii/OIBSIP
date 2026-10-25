const cron = require("node-cron");
const mongoose = require("mongoose");
const validator = require("validator");
const Ingredient = require("../models/Ingredient");
const { sendEmail } = require("../utils/sendEmail");

let task = null;

async function checkLowStock(recipient) {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    // Kur stoku rikthehet në nivel normal, lejo një njoftim të ardhshëm.
    await Ingredient.updateMany(
      {
        lowStockAlertSentAt: { $ne: null },
        $expr: { $gte: ["$stock", "$lowStockThreshold"] },
      },
      {
        $set: { lowStockAlertSentAt: null },
      }
    );

    const ingredients = await Ingredient.find({
      isActive: true,
      lowStockAlertSentAt: null,
      $expr: { $lt: ["$stock", "$lowStockThreshold"] },
    })
      .select("name category stock lowStockThreshold updatedAt")
      .lean();

    for (const ingredient of ingredients) {
      try {
        await sendEmail({
          to: recipient,
          subject: `Low stock: ${ingredient.name}`,
          text: [
            "Pizza Delivery - Low stock alert",
            "",
            `Ingredient: ${ingredient.name}`,
            `Category: ${ingredient.category}`,
            `Current stock: ${ingredient.stock}`,
            `Alert threshold: ${ingredient.lowStockThreshold}`,
            "",
            "Please check and replenish this ingredient.",
          ].join("\n"),
        });

        // Ruaje njoftimin vetëm nëse përbërësi nuk ndryshoi gjatë dërgimit.
        await Ingredient.updateOne(
          {
            _id: ingredient._id,
            updatedAt: ingredient.updatedAt,
            lowStockAlertSentAt: null,
          },
          {
            $set: { lowStockAlertSentAt: new Date() },
          }
        );

        console.log(`Low stock email sent: ${ingredient.name}`);
      } catch (error) {
        console.error(
          `Low stock alert failed for ${ingredient.name}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error("Low stock check:", error.message);
  }
}

function startLowStockAlerts() {
  if (task) {
    return task;
  }

  const recipient = process.env.ADMIN_ALERT_EMAIL?.trim();

  if (!recipient || !validator.isEmail(recipient)) {
    console.error(
      "Low stock alerts disabled: ploteso ADMIN_ALERT_EMAIL te backend/.env"
    );
    return null;
  }

  task = cron.schedule(
    "* * * * *",
    async () => {
      await checkLowStock(recipient);
    },
    {
      name: "low-stock-alerts",
      noOverlap: true,
    }
  );

  console.log("Low stock alerts enabled: checking every minute.");

  return task;
}

module.exports = { startLowStockAlerts };