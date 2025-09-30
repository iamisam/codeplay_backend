import { User, AcSubmission, TotalSubmission } from "../models/user.js";
import RefreshToken from "../models/refreshToken.js";
import { createAccessToken } from "../utils/jwt.js";
import { sendVerificationEmail } from "../utils/emailService.js";
import { updateOrCreateUserFromLeetCode } from "./userController.js";
import axios from "axios";
import { randomBytes } from "crypto";
import UAParser from "user-agent-parser";

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

function setTokenCookie(res, token, expires) {
  const cookieOptions = {
    httpOnly: true,
    expires,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };
  res.cookie("refreshToken", token, cookieOptions);
}

async function issueTokensAndLogin(req, res, user, rememberMe) {
  const ip = req.ip;
  const ua = UAParser(req.headers["user-agent"]);
  const deviceName = `${ua.browser.name} on ${ua.os.name}`;

  try {
    await updateOrCreateUserFromLeetCode(user.leetcodeUsername);
  } catch (syncError) {
    console.error(
      `Failed to sync data for ${user.leetcodeUsername} on login:`,
      syncError.message,
    );
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

const initiateSignup = async (req, res) => {
  const { leetcodeUsername, email, password } = req.body;

  if (!leetcodeUsername || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    if (await User.findOne({ where: { email } })) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }
    if (await User.findOne({ where: { leetcodeUsername } })) {
      return res.status(409).json({
        message: "An account with this LeetCode username already exists.",
      });
    }
    await axios.get(
      `https://leetcode-api-pied.vercel.app/user/${leetcodeUsername}`,
    );

    // temporary, unverified user record to hold the OTP
    const tempUser = { email };

    // user record with the OTP. It's not fully "live" until verified.
    const newUser = await User.create({
      email,
      password, // Hashed by hook
      leetcodeUsername,
      verificationToken: tempUser.verificationToken,
      isEmailVerified: false,
    });

    await sendVerificationEmail(newUser);

    res.status(200).json({ message: "Verification OTP sent to your email." });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return res
        .status(404)
        .json({ message: `LeetCode user '${leetcodeUsername}' not found.` });
    }
    console.error("Initiate Signup Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const verifyOtpAndFinalize = async (req, res) => {
  const { email, otp, rememberMe } = req.body;
  const user = await User.findOne({ where: { email, verificationToken: otp } });

  if (!user) {
    return res.status(400).json({ message: "Invalid OTP." });
  }

  user.verificationToken = null;
  user.isEmailVerified = true;

  const leetcodeData = (
    await axios.get(
      `https://leetcode-api-pied.vercel.app/user/${user.leetcodeUsername}`,
    )
  ).data;

  user.realName = leetcodeData.profile.realName;
  user.countryName = leetcodeData.profile.countryName;
  user.company = leetcodeData.profile.company;
  user.school = leetcodeData.profile.school;
  user.aboutMe = leetcodeData.profile.aboutMe;
  user.reputation = leetcodeData.profile.reputation;
  user.ranking = leetcodeData.profile.ranking;
  await user.save();

  const acInsertions = leetcodeData.submitStats.acSubmissionNum.map((item) => ({
    userId: user.userId,
    username: user.leetcodeUsername,
    ...item,
  }));
  const totalInsertions = leetcodeData.submitStats.totalSubmissionNum.map(
    (item) => ({
      userId: user.userId,
      username: user.leetcodeUsername,
      ...item,
    }),
  );
  await AcSubmission.destroy({ where: { userId: user.userId } });
  await TotalSubmission.destroy({ where: { userId: user.userId } });
  await AcSubmission.bulkCreate(acInsertions);
  await TotalSubmission.bulkCreate(totalInsertions);

  await issueTokensAndLogin(req, res, user, rememberMe);
};

const login = async (req, res) => {
  const { email, password, rememberMe } = req.body;
  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        error: "EmailNotVerified",
        message: "Please verify your email before logging in.",
      });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    await issueTokensAndLogin(req, res, user, rememberMe);
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

const logout = async (req, res) => {
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
};

export { initiateSignup, verifyOtpAndFinalize, login, logout };
