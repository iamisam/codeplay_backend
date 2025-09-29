import express from "express";
import {
  initiateSignup,
  verifyOtpAndFinalize,
  login,
  logout,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// --- Public Authentication Routes ---
router.post("/initiate-signup", initiateSignup);
router.post("/complete-signup", verifyOtpAndFinalize);

// Standard login
router.post("/login", login);

// --- Protected Authentication Route ---
router.post("/logout", authMiddleware, logout);

export default router;
