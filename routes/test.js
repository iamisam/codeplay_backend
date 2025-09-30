import authMiddleware from "../middleware/auth.middleware.js"; // Make sure you import your middleware
import express from "express";

const router = express.Router();

router.get("/test-protected-route", authMiddleware, (req, res) => {
  res.json({
    message: `Success! You are authenticated.`,
    user: req.user,
  });
});

export default router;
