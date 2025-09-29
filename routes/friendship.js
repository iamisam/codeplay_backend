import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  cancelOrDeclineRequest,
  getFriends,
  removeFriend,
} from "../controllers/friendshipController.js";

const router = express.Router();

// All friendship routes are protected
router.use(authMiddleware);

// Send a friend request to a user
router.post("/request/:recipientId", sendFriendRequest);

// Get all pending requests (incoming and outgoing)
router.get("/requests", getFriendRequests);

// Accept a friend request from a user
router.put("/accept/:requesterId", acceptFriendRequest);

// Cancel a sent request or decline a received one
router.delete("/request/:otherUserId", cancelOrDeclineRequest);

// Get the user's friend list
router.get("/", getFriends);

router.delete("/:friendId", removeFriend);

export default router;
