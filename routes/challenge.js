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
router.post("/invite", inviteUser);

router.get("/invites", getInvites);

router.put("/invites/:challengeId/accept", acceptInvite);

router.delete("/invites/:challengeId/decline", declineInvite);

router.get("/:challengeId", getChallengeDetails);
router.post("/:challengeId/submit", submitSolution);
router.get("/:challengeId/status", getChallengeStatus);

export default router;
