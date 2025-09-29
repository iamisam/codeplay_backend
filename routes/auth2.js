import express from "express";
import axios from "axios";
import { randomBytes } from "crypto";
import UAParser from "user-agent-parser";

import { User, AcSubmission, TotalSubmission } from "../models/user.js";
import RefreshToken from "../models/refreshToken.js";
import { createAccessToken } from "../utils/jwt.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { updateOrCreateUserFromLeetCode } from "../controllers/userController.js";

const router = express.Router();

// --- Helper to create and store a refresh token ---
async function createAndStoreRefreshToken(user, ip, deviceName, rememberMe) {
  const expiryDays = rememberMe ? 7 : 1;
  const expires = new Date();
  expires.setDate(expires.getDate() + expiryDays);

  const token = `${user.userId}.${randomBytes(40).toString("hex")}`;

  const refreshToken = await RefreshToken.create({
    token,
    userId: user.userId,
    expires,
    createdByIp: ip,
    deviceName,
  });

  return refreshToken;
}

// --- Helper to set the cookie ---
function setTokenCookie(res, token, expires) {
  const cookieOptions = {
    httpOnly: true,
    expires,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };
  res.cookie("refreshToken", token, cookieOptions);
}

// --- Generic Login/Signup Response ---
async function loginUser(req, res, user, rememberMe) {
  const ip = req.ip;
  const ua = UAParser(req.headers["user-agent"]);
  const deviceName = `${ua.browser.name} on ${ua.os.name}`;

  // --- Sync LeetCode data on login ---
  // This ensures the user's stats are always up-to-date when they log in.
  try {
    await updateOrCreateUserFromLeetCode(user.leetcodeUsername);
  } catch (syncError) {
    console.error(
      `Failed to sync data for ${user.leetcodeUsername} on login:`,
      syncError.message,
    );
    // We don't block the login, just log the error. The user can still use the site.
  }

  user.status = "online";
  await user.save();

  const refreshToken = await createAndStoreRefreshToken(
    user,
    ip,
    deviceName,
    rememberMe,
  );
  const accessToken = createAccessToken({
    userId: user.userId,
    email: user.email,
  });

  setTokenCookie(res, refreshToken.token, refreshToken.expires);

  res.json({ accessToken });
}

// --- SIGNUP ROUTE ---
router.post("/signup", async (req, res) => {
  const { leetcodeUsername, email, password, rememberMe } = req.body;
  if (!leetcodeUsername || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields." });
  }

  try {
    if (await User.findOne({ where: { email } })) {
      return res
        .status(409)
        .json({ message: "User with this email already exists." });
    }

    // 2. Fetch the LeetCode data first
    const leetcodeData = (
      await axios.get(
        `https://leetcode-api-pied.vercel.app/user/${leetcodeUsername}`,
      )
    ).data;

    // 3. Create the new user with ALL data at once
    const newUser = await User.create({
      // Data from the form
      email,
      password, // The hashing hook will take care of this
      leetcodeUsername,
      // Data from the LeetCode API
      realName: leetcodeData.profile.realName,
      countryName: leetcodeData.profile.countryName,
      company: leetcodeData.profile.company,
      school: leetcodeData.profile.school,
      aboutMe: leetcodeData.profile.aboutMe,
      reputation: leetcodeData.profile.reputation,
      ranking: leetcodeData.profile.ranking,
    });

    // 4. Now that the user exists, sync their submission stats
    // This logic can be moved to a controller function later if desired
    const acInsertions = leetcodeData.submitStats.acSubmissionNum.map(
      (item) => ({
        userId: newUser.userId,
        username: newUser.leetcodeUsername,
        difficulty: item.difficulty,
        count: item.count,
        submissions: item.submissions,
      }),
    );
    await AcSubmission.bulkCreate(acInsertions);

    const totalInsertions = leetcodeData.submitStats.totalSubmissionNum.map(
      (item) => ({
        userId: newUser.userId,
        username: newUser.leetcodeUsername,
        difficulty: item.difficulty,
        count: item.count,
        submissions: item.submissions,
      }),
    );
    await TotalSubmission.bulkCreate(totalInsertions);

    await loginUser(req, res, newUser, rememberMe);
  } catch (error) {
    console.error("Signup Error:", error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return res.status(404).json({
        message: `LeetCode user '${leetcodeUsername}' not found. Please check the username.`,
      });
    }
    res.status(500).json({ message: "An internal server error occurred." });
  }
});

// --- LOGIN ROUTE ---
router.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    // The loginUser helper now handles the data sync
    await loginUser(req, res, user, rememberMe);
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
});

// The logout route should be protected to ensure a user is logged in before they can log out.
router.post("/logout", authMiddleware, async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const refreshToken = await RefreshToken.findOne({ where: { token } });
    if (refreshToken) {
      const user = await User.findByPk(refreshToken.userId);
      if (user) {
        user.status = "offline";
        await user.save();
      }
      refreshToken.revokedAt = new Date();
      refreshToken.revokedByIp = req.ip;
      await refreshToken.save();
    }
  }
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully." });
});

export default router;
