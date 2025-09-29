import { User } from "../models/user.js";
import Friendship from "../models/friendship.js";
import { Op, where } from "sequelize";

const sendFriendRequest = async (req, res) => {
  const requesterId = req.user.userId;
  const { recipientId } = req.params;

  if (requesterId === parseInt(recipientId, 10)) {
    return res
      .status(400)
      .json({ message: "You cannot send a friend request to yourself." });
  }

  try {
    const existingFriendship = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });

    if (existingFriendship) {
      return res.status(409).json({
        message: "A friend request already exists or you are already friends.",
      });
    }

    await Friendship.create({ requesterId, recipientId, status: "pending" });
    res.status(201).json({ message: "Friend request sent." });
  } catch (error) {
    console.error("Send Request Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

/**
 * GET /api/friends/requests
 * Fetches all pending friend requests for the currently logged-in user.
 * This includes both requests they have sent (outgoing) and requests
 * they have received (incoming).
 */
const getFriendRequests = async (req, res) => {
  // req.user.userId is added by the authMiddleware
  const userId = req.user.userId;
  try {
    const requests = await Friendship.findAll({
      where: {
        status: "pending",
        // Find any request where the user is either the sender or receiver
        [Op.or]: [{ requesterId: userId }, { recipientId: userId }],
      },
      // Include the user data for both the requester and the recipient
      // so the frontend knows who is involved in the request.
      include: [
        {
          model: User,
          as: "requester",
          attributes: ["userId", "displayName", "leetcodeUsername"],
        },
        {
          model: User,
          as: "recipient",
          attributes: ["userId", "displayName", "leetcodeUsername"],
        },
      ],
    });
    res.json(requests);
  } catch (error) {
    console.error("Get Requests Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

/**
 * GET /api/friends
 * Fetches a list of all accepted friends for the currently logged-in user.
 * It sorts them by their current status (online > away > offline).
 */
const getFriends = async (req, res) => {
  const userId = req.user.userId;
  try {
    const friendships = await Friendship.findAll({
      where: {
        status: "accepted",
        [Op.or]: [{ requesterId: userId }, { recipientId: userId }],
      },
      include: [
        {
          model: User,
          as: "requester",
          attributes: ["userId", "displayName", "leetcodeUsername", "status"],
        },
        {
          model: User,
          as: "recipient",
          attributes: ["userId", "displayName", "leetcodeUsername", "status"],
        },
      ],
    });

    // The query returns the 'friendship' record. We need to extract just
    // the other person's user data from each record.
    const friends = friendships.map((friendship) => {
      // If the current user was the one who sent the request, the friend is the 'recipient'.
      // Otherwise, the friend is the 'requester'.
      return friendship.requesterId === userId
        ? friendship.recipient
        : friendship.requester;
    });

    res.json(friends);
  } catch (error) {
    console.error("Get Friends Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const acceptFriendRequest = async (req, res) => {
  const recipientId = req.user.userId;
  const { requesterId } = req.params;

  try {
    const request = await Friendship.findOne({
      where: { requesterId, recipientId, status: "pending" },
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    request.status = "accepted";
    await request.save();
    res.json({ message: "Friend request accepted." });
  } catch (error) {
    console.error("Accept Request Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const cancelOrDeclineRequest = async (req, res) => {
  const currentUserId = req.user.userId;
  const { otherUserId } = req.params;

  try {
    const result = await Friendship.destroy({
      where: {
        status: "pending",
        [Op.or]: [
          { requesterId: currentUserId, recipientId: otherUserId },
          { requesterId: otherUserId, recipientId: currentUserId },
        ],
      },
    });

    if (result === 0) {
      return res.status(404).json({ message: "Request not found." });
    }
    res.json({ message: "Request removed." });
  } catch (error) {
    console.error("Cancel/Decline Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const removeFriend = async (req, res) => {
  const currentUserId = req.user.userId;
  const { friendId } = req.params;

  try {
    // Find and delete the 'accepted' friendship record between the two users
    const result = await Friendship.destroy({
      where: {
        status: "accepted",
        [Op.or]: [
          { requesterId: currentUserId, recipientId: friendId },
          { requesterId: friendId, recipientId: currentUserId },
        ],
      },
    });

    if (result === 0) {
      return res.status(404).json({ message: "Friendship not found." });
    }
    res.json({ message: "Friend removed successfully." });
  } catch (error) {
    console.error("Remove Friend Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

export {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  cancelOrDeclineRequest,
  getFriends,
  removeFriend,
};
