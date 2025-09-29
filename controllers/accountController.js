import { User } from "../models/user.js"; // Adjust path if needed
import { sendPasswordResetEmail } from "../utils/emailService.js";
import { Op } from "sequelize";

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ where: { email } });

  if (user) {
    await sendPasswordResetEmail(user);
  }
  res.json({
    message:
      "If an account with that email exists, a password reset OTP has been sent.",
  });
};

const resetPassword = async (req, res) => {
  const { email, otp, password } = req.body;
  const user = await User.findOne({
    where: {
      email,
      passwordResetToken: otp,
      passwordResetExpires: { [Op.gt]: Date.now() },
    },
  });

  if (!user) {
    return res
      .status(400)
      .json({ message: "Invalid OTP or it may have expired." });
  }

  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  res.json({ message: "Password has been reset successfully." });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findByPk(req.user.userId);

  if (!user || !(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ message: "Incorrect current password." });
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: "Password changed successfully." });
};

export { forgotPassword, resetPassword, changePassword };
