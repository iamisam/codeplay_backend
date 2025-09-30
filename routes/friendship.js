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

router.post("/request/:recipientId", sendFriendRequest);

router.get("/requests", getFriendRequests);

router.put("/accept/:requesterId", acceptFriendRequest);

router.delete("/request/:otherUserId", cancelOrDeclineRequest);

router.get("/", getFriends);

router.delete("/:friendId", removeFriend);

export default router;
