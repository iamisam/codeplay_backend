import express from "express";
import { randomBytes } from "crypto";
import UAParser from "user-agent-parser";

import RefreshToken from "../models/refreshToken.js";
import { createAccessToken } from "../utils/jwt.js";

import User from "../models/user.js";

const router = express.Router();

async function createAndStoreRefreshToken(user, ip, deviceName) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // Assume 7 days on refresh

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

router.post("/refresh", async (req, res) => {
  const incomingToken = req.cookies.refreshToken;
  if (!incomingToken)
    return res.status(401).json({ message: "No refresh token provided." });

  const ip = req.ip;
  try {
    const oldToken = await RefreshToken.findOne({
      where: { token: incomingToken },
      include: [
        {
          model: User,
          required: true,
        },
      ],
    });

    if (!oldToken || !oldToken.isActive()) {
      return res
        .status(403)
        .json({ message: "Invalid or expired refresh token." });
    }

    const ua = UAParser(req.headers["user-agent"]);
    const deviceName = `${ua.browser.name} on ${ua.os.name}`;
    const newRefreshToken = await createAndStoreRefreshToken(
      oldToken.user,
      ip,
      deviceName,
    );

    oldToken.revokedAt = new Date();
    oldToken.revokedByIp = ip;
    oldToken.replacedByToken = newRefreshToken.token;
    await oldToken.save();

    const newAccessToken = createAccessToken({
      userId: oldToken.user.userId,
      email: oldToken.user.email,
    });

    setTokenCookie(res, newRefreshToken.token, newRefreshToken.expires);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Refresh Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
