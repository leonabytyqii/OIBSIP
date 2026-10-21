const express = require("express");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const { rateLimit } = require("express-rate-limit");
const User = require("../models/User");
const { sendVerificationEmail } = require("../utils/sendVerificationEmail");
const { hashToken } = require("../utils/tokens");
const { sendPasswordResetEmail } = require("../utils/sendPasswordResetEmail");
const { sendEmail } = require("../utils/sendEmail");
const { createAccessToken } = require("../utils/authToken");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();
router.get("/me", requireAuth, (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
});

router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!validator.isLength(cleanName, { min: 2, max: 80 })) {
      return res.status(400).json({
        message: "Name must contain 2 to 80 characters.",
      });
    }

    if (cleanEmail.length > 254 || !validator.isEmail(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (
      !validator.isLength(password, { min: 12 }) ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Password must have at least 12 characters and at most 72 bytes.",
      });
    }

    await User.init();

    const existingUser = await User.exists({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: "user",
      isVerified: false,
    });

     let verificationEmailSent = false;

    try {
      await sendVerificationEmail(user);
      verificationEmailSent = true;
    } catch (emailError) {
      console.error("Verification email:", emailError.message);
    }

    return res.status(201).json({
      message: verificationEmailSent
        ? "Account created. Check your email to verify your account."
        : "Account created. Verification email could not be sent.",
      verificationEmailSent,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      message: "Registration failed. Please try again.",
    });
  }
});

module.exports = router;
const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
});
const passwordResetReply = {
  message:
    "If an account exists for this email, a password reset link will be sent.",
};

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please try again later.",
  },
});

const forgotEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  keyGenerator: (req) => req.passwordResetEmail,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(200).json(passwordResetReply);
  },
});

router.post(
  "/forgot-password",
  passwordLimiter,
  (req, res, next) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (email.length > 254 || !validator.isEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    req.passwordResetEmail = email;
    next();
  },
  forgotEmailLimiter,
  async (req, res) => {
    try {
      const user = await User.findOne({
        email: req.passwordResetEmail,
      }).select("name email");

      if (user) {
        sendPasswordResetEmail(user).catch((error) => {
          console.error("Password reset email:", error.message);
        });
      }

      return res.status(200).json(passwordResetReply);
    } catch (error) {
      console.error("Forgot password:", error.message);

      return res.status(500).json({
        message: "Unable to process your request. Please try again.",
      });
    }
  }
);

router.post("/reset-password", passwordLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired.",
      });
    }

    if (
      typeof password !== "string" ||
      !validator.isLength(password, { min: 12 }) ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message:
          "Password must have at least 12 characters and at most 72 bytes.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    const tokenHash = hashToken(token);

    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select("email");

    if (!user) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await User.updateOne(
      {
        _id: user._id,
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordHash },
        $unset: {
          resetTokenHash: "",
          resetTokenExpiresAt: "",
        },
        $inc: { tokenVersion: 1 },
      }
    );

    if (result.modifiedCount !== 1) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired.",
      });
    }

    sendEmail({
      to: user.email,
      subject: "Your Pizza Delivery password was changed",
      text: [
        "Your Pizza Delivery password has been changed.",
        "",
        "If you did not make this change, request a password reset immediately.",
      ].join("\n"),
    }).catch((error) => {
      console.error("Password change notification:", error.message);
    });

    return res.status(200).json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Reset password:", error.message);

    return res.status(500).json({
      message: "Unable to reset your password. Please try again.",
    });
  }
});
router.post("/verify-email", verifyEmailLimiter, async (req, res) => {
  try {
    const { token } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return res.status(400).json({
        message: "Invalid verification link.",
      });
    }

    const result = await User.updateOne(
      {
        verificationTokenHash: hashToken(token),
        verificationTokenExpiresAt: { $gt: new Date() },
        isVerified: false,
      },
      {
        $set: {
          isVerified: true,
        },
        $unset: {
          verificationTokenHash: "",
          verificationTokenExpiresAt: "",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      return res.status(400).json({
        message: "Verification link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      message: "Email verified successfully.",
    });
  } catch (error) {
    console.error("Email verification:", error.message);

    return res.status(500).json({
      message: "Email verification failed. Please try again.",
    });
  }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanEmail.length > 254 ||
      !validator.isEmail(cleanEmail) ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Please enter a valid email and password.",
      });
    }

    const user = await User.findOne({
      email: cleanEmail,
    }).select("+passwordHash +tokenVersion");

    if (!user) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    const accessToken = createAccessToken(user);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      message: "Logged in successfully.",
      accessToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login:", error.message);

    return res.status(500).json({
      message: "Unable to log in. Please try again.",
    });
  }
});