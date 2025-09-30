import axios from "axios";
import { User, AcSubmission, TotalSubmission } from "../models/user.js";
import Friendship from "../models/friendship.js";
import sequelize from "../utils/database.js";
import { Op } from "sequelize";

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ["password"] },
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
    if (error.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ message: "Display name is already taken." });
    }
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

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
          requesterId: friendship.requesterId,
        };
      }
    }

    const profileData = user.toJSON();
    profileData.friendshipStatus = friendshipStatus;

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
        username: user.leetcodeUsername,
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

  return user;
};

const getComparisonData = async (req, res) => {
  const currentUserId = req.user.userId;
  const { otherUserIdentifier } = req.params;

  try {
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
