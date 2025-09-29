import axios from "axios";
import { User, AcSubmission, TotalSubmission } from "../models/user.js"; // Adjust the path if needed
import Friendship from "../models/friendship.js";
import sequelize from "../utils/database.js";
import { Op } from "sequelize";

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ["password"] }, // Never send the password hash
      include: [
        { model: AcSubmission, as: "acSubmissions" },
        { model: TotalSubmission, as: "totalSubmissions" },
      ],
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateMyProfile = async (req, res) => {
  const { displayName, profileVisibility } = req.body;
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update fields if they were provided
    if (displayName) user.displayName = displayName;
    if (
      profileVisibility &&
      ["public", "private"].includes(profileVisibility)
    ) {
      user.profileVisibility = profileVisibility;
    }

    await user.save();
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    // Handle unique constraint error for displayName
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Display name is already taken." });
    }
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Search for Users ---
const searchUsers = async (req, res) => {
  const { query } = req.query;
  if (!query)
    return res.status(400).json({ message: "Query parameter is required" });

  try {
    const users = await User.findAll({
      where: {
        [Op.or]: [
          {
            displayName: {
              [Op.like]: `%${query}%`,
            },
          },
          {
            leetcodeUsername: {
              [Op.like]: `%${query}%`,
            },
          },
        ],
      },
      attributes: ["displayName", "leetcodeUsername", "ranking"],
      limit: 10,
    });
    res.json(users);
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getUserProfileByDisplayName = async (req, res) => {
  try {
    const { displayName } = req.params;
    const viewingUserId = req.user.userId;
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { displayName: displayName },
          { leetcodeUsername: displayName },
        ],
      },
      attributes: { exclude: ["password", "email"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let friendshipStatus = null;
    if (viewingUserId !== user.userId) {
      const friendship = await Friendship.findOne({
        where: {
          [Op.or]: [
            { requesterId: viewingUserId, recipientId: user.userId },
            { requesterId: user.userId, recipientId: viewingUserId },
          ],
        },
      });
      if (friendship) {
        friendshipStatus = {
          status: friendship.status,
          // Note who the original requester was
          requesterId: friendship.requesterId,
        };
      }
    }

    const profileData = user.toJSON();
    profileData.friendshipStatus = friendshipStatus;

    // If the profile is private, return limited data
    if (user.profileVisibility === "private") {
      if (friendshipStatus?.status !== "accepted") {
        return res.json({
          userId: user.userId,
          displayName: user.displayName,
          leetcodeUsername: user.leetcodeUsername,
          profileVisibility: "private",
          friendshipStatus: profileData.friendshipStatus,
        });
      }
    }

    // If public, fetch the full profile with stats
    const fullProfile = await User.findByPk(user.userId, {
      attributes: { exclude: ["password", "email"] },
      include: [
        { model: AcSubmission, as: "acSubmissions" },
        { model: TotalSubmission, as: "totalSubmissions" },
      ],
    });
    const responseData = fullProfile.toJSON();
    responseData.friendshipStatus = friendshipStatus;

    res.json(responseData);
  } catch (error) {
    console.error("Get Public Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- NEW: Update Current User's Status ---
const updateMyStatus = async (req, res) => {
  const { status } = req.body;
  if (!status || !["online", "away"].includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided. Must be 'online' or 'away'.",
    });
  }

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = status;
    await user.save();

    res.json({ message: `Status updated to ${status}` });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Fetches data for a LeetCode user and updates or creates a record in the local database.
 * This includes syncing their profile and all submission stats.
 * @param {string} leetcodeUsername - The LeetCode username to sync.
 * @returns {Promise<User>} The created or updated user instance from the database.
 * @throws {Error} If the LeetCode user is not found or if there's a database error.
 */
const updateOrCreateUserFromLeetCode = async (leetcodeUsername) => {
  let leetcodeApiData;
  try {
    const response = await axios.get(
      `https://leetcode-api-pied.vercel.app/user/${leetcodeUsername}`,
    );
    leetcodeApiData = response.data;
  } catch (apiError) {
    console.error(
      `Failed to fetch data for ${leetcodeUsername}:`,
      apiError.message,
    );
    throw new Error(`LeetCode user '${leetcodeUsername}' not found.`);
  }

  // 2. Find an existing user or prepare to create a new one
  // Note: We find by leetcodeUsername, not the primary key, as this is the sync point.
  const [user, created] = await User.findOrCreate({
    where: { leetcodeUsername: leetcodeApiData.username },
    defaults: {
      leetcodeUsername: leetcodeApiData.username,
      realName: leetcodeApiData.profile.realName,
      countryName: leetcodeApiData.profile.countryName,
      company: leetcodeApiData.profile.company,
      school: leetcodeApiData.profile.school,
      aboutMe: leetcodeApiData.profile.aboutMe,
      reputation: leetcodeApiData.profile.reputation,
      ranking: leetcodeApiData.profile.ranking,
    },
  });

  // 3. If the user already existed, update their profile data
  if (!created) {
    await user.update({
      realName: leetcodeApiData.profile.realName,
      countryName: leetcodeApiData.profile.countryName,
      company: leetcodeApiData.profile.company,
      school: leetcodeApiData.profile.school,
      aboutMe: leetcodeApiData.profile.aboutMe,
      reputation: leetcodeApiData.profile.reputation,
      ranking: leetcodeApiData.profile.ranking,
    });
  }

  // 4. Clear old submission stats and bulk insert the new ones
  // Using a transaction ensures this is an all-or-nothing operation
  await sequelize.transaction(async (t) => {
    await AcSubmission.destroy({
      where: { userId: user.userId },
      transaction: t,
    });
    await TotalSubmission.destroy({
      where: { userId: user.userId },
      transaction: t,
    });

    const acInsertions = leetcodeApiData.submitStats.acSubmissionNum.map(
      (item) => ({
        userId: user.userId,
        username: user.leetcodeUsername, // Use the consistent username
        difficulty: item.difficulty,
        count: item.count,
        submissions: item.submissions,
      }),
    );
    await AcSubmission.bulkCreate(acInsertions, { transaction: t });

    const totalInsertions = leetcodeApiData.submitStats.totalSubmissionNum.map(
      (item) => ({
        userId: user.userId,
        username: user.leetcodeUsername,
        difficulty: item.difficulty,
        count: item.count,
        submissions: item.submissions,
      }),
    );
    await TotalSubmission.bulkCreate(totalInsertions, { transaction: t });
  });

  // 5. Return the user instance
  return user;
};

const getComparisonData = async (req, res) => {
  const currentUserId = req.user.userId;
  const { otherUserIdentifier } = req.params;

  try {
    // Fetch both users' full profiles simultaneously
    const [currentUser, otherUser] = await Promise.all([
      User.findByPk(currentUserId, {
        attributes: { exclude: ["password", "email"] },
        include: [
          { model: AcSubmission, as: "acSubmissions" },
          { model: TotalSubmission, as: "totalSubmissions" },
        ],
      }),
      User.findOne({
        where: {
          [Op.or]: [
            { displayName: otherUserIdentifier },
            { leetcodeUsername: otherUserIdentifier },
          ],
        },
        attributes: { exclude: ["password", "email"] },
        include: [
          { model: AcSubmission, as: "acSubmissions" },
          { model: TotalSubmission, as: "totalSubmissions" },
        ],
      }),
    ]);

    if (!currentUser || !otherUser) {
      return res
        .status(404)
        .json({ message: "One or both users could not be found." });
    }

    res.json({ currentUser, otherUser });
  } catch (error) {
    console.error("Comparison Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

export {
  updateOrCreateUserFromLeetCode,
  searchUsers,
  getMyProfile,
  updateMyProfile,
  getUserProfileByDisplayName,
  updateMyStatus,
  getComparisonData,
};
