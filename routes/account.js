import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/accountController.js";

const router = express.Router();

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// protected for logged-in user
router.put("/change-password", authMiddleware, changePassword);

export default router;
