import nodemailer from "nodemailer";
import { User } from "../models/user.js";

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"CodePlay" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to} via Nodemailer`);
  } catch (error) {
    console.error("Nodemailer sending error:", error);
    throw new Error("Failed to send email.");
  }
};

const sendVerificationEmail = async (user) => {
  const otp = generateOtp();
  user.verificationToken = otp;
  await user.save();

  const htmlContent = `<h1>Welcome to CodePlay!</h1><p>Your verification code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`;

  await sendEmail({
    to: user.email,
    subject: "Verify Your CodePlay Account",
    html: htmlContent,
  });
};

const sendPasswordResetEmail = async (user) => {
  const otp = generateOtp();
  user.passwordResetToken = otp;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  const htmlContent = `<h1>CodePlay Password Reset</h1><p>Your password reset code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`;

  await sendEmail({
    to: user.email,
    subject: "Your CodePlay Password Reset Code",
    html: htmlContent,
  });
};

export { sendVerificationEmail, sendPasswordResetEmail };
