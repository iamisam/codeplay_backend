import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  inviteUser,
  getInvites,
  acceptInvite,
  declineInvite,
  getChallengeDetails,
  submitSolution,
  searchProblems,
  getDailyProblem,
  getChallengeStatus,
} from "../controllers/challengeController.js";
const router = express.Router();

router.use(authMiddleware);
router.get("/search-problems", searchProblems);
router.get("/daily-problem", getDailyProblem);
// Invite a user to a challenge
router.post("/invite", inviteUser);

// Get all pending challenge invitations for the logged-in user
router.get("/invites", getInvites);

// Accept an invitation
router.put("/invites/:challengeId/accept", acceptInvite);

// Decline or cancel an invitation
router.delete("/invites/:challengeId/decline", declineInvite);

router.get("/:challengeId", getChallengeDetails);
router.post("/:challengeId/submit", submitSolution);
router.get("/:challengeId/status", getChallengeStatus);

export default router;
