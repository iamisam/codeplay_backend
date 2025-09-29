import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  getMyProfile,
  updateMyProfile,
  searchUsers,
  getUserProfileByDisplayName,
  updateMyStatus,
  getComparisonData,
} from "../controllers/userController.js";

const router = express.Router();

// --- Protected Routes ---
// These require a valid access token to be accessed

// GET /api/user/me - Fetches the logged-in user's profile
router.get("/me", authMiddleware, getMyProfile);

// PUT /api/user/me - Updates the logged-in user's profile
router.put("/me", authMiddleware, updateMyProfile);

// GET /api/user/search?query=... - Searches for users by display name
router.get("/search", authMiddleware, searchUsers);

// GET /api/user/profile/:displayName - shows profile of searched user when user clicks on it
router.get(
  "/profile/:displayName",
  authMiddleware,
  getUserProfileByDisplayName,
);

// PUT /api/user/me/status - update user status
router.put("/me/status", authMiddleware, updateMyStatus);

// --- Route for getting comparison data ---
router.get("/compare/:otherUserIdentifier", authMiddleware, getComparisonData);

export default router;
