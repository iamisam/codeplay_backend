import User from "../models/user.js";
import { Challenge, ChallengeSubmission } from "../models/challenge.js"; // Adjust path if needed
import { Op } from "sequelize";
import axios from "axios";
import { getProblemBySlug } from "../utils/problemStore.js"; // Import our problem store

// --- NEW: Get the daily problem details ---
const getDailyProblem = async (req, res) => {
  try {
    const dailyProblemRes = await axios.get(
      "https://leetcode-api-pied.vercel.app/daily",
    );
    // Format the response to send only what the frontend modal needs
    const problem = {
      title: dailyProblemRes.data.question.title,
      titleSlug: dailyProblemRes.data.question.titleSlug,
    };
    res.json(problem);
  } catch (error) {
    console.error("Get Daily Problem Error:", error);
    res.status(500).json({ message: "Failed to fetch daily problem." });
  }
};

// --- Invite a user to a challenge ---
const inviteUser = async (req, res) => {
  const challengerId = req.user.userId;
  const { recipientId, problemTitleSlug, problemTitle } = req.body;

  try {
    // Cooldown Logic
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChallenge = await Challenge.findOne({
      where: {
        [Op.or]: [
          { challengerId, recipientId },
          { challengerId: recipientId, recipientId: challengerId },
        ],
        updatedAt: { [Op.gte]: twentyFourHoursAgo },
        status: "completed",
      },
    });

    if (recentChallenge && !problemTitleSlug) {
      return res.status(429).json({
        message:
          "You can only challenge this user to the daily problem once per day.",
      });
    }

    let finalProblemSlug = problemTitleSlug;
    let finalProblemTitle = problemTitle;

    // If no custom problem is provided, fetch the daily problem
    if (!finalProblemSlug) {
      const dailyProblemRes = await axios.get(
        "https://leetcode-api-pied.vercel.app/daily",
      );
      finalProblemSlug = dailyProblemRes.data.question.titleSlug;
      finalProblemTitle = dailyProblemRes.data.question.title;
    }

    const newChallenge = await Challenge.create({
      challengerId,
      recipientId,
      problemTitleSlug: finalProblemSlug,
      problemTitle: finalProblemTitle, // Store the title for easy display
      status: "pending",
    });

    res.status(201).json(newChallenge);
  } catch (error) {
    console.error("Invite Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// --- NEW: Search for problems for the custom challenge modal ---
const searchProblems = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  try {
    const response = await axios.get(
      `https://leetcode-api-pied.vercel.app/search?query=${query}`,
    );
    // Standardize the API response structure for the frontend
    const formattedResults = response.data.map((p) => ({
      title: p.title,
      titleSlug: p.title_slug,
    }));
    res.json(formattedResults);
  } catch (error) {
    console.error("Problem Search Error:", error);
    res.status(500).json({ message: "Failed to search for problems." });
  }
};

// --- Get all pending challenge invitations ---
const getInvites = async (req, res) => {
  const userId = req.user.userId;
  try {
    const invites = await Challenge.findAll({
      where: {
        status: "pending",
        [Op.or]: [{ challengerId: userId }, { recipientId: userId }],
      },
      include: [
        {
          association: "challenger",
          attributes: ["displayName", "leetcodeUsername"],
        },
        {
          association: "recipient",
          attributes: ["displayName", "leetcodeUsername"],
        },
      ],
    });
    res.json(invites);
  } catch (error) {
    console.error("Get Invites Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// --- Accept a challenge invitation ---
const acceptInvite = async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.userId;
  try {
    const challenge = await Challenge.findOne({
      where: { id: challengeId, recipientId: userId, status: "pending" },
    });
    if (!challenge)
      return res.status(404).json({
        message: "Invitation not found or you are not the recipient.",
      });

    challenge.status = "active";
    await challenge.save();
    res.json(challenge);
  } catch (error) {
    console.error("Accept Invite Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// --- Decline or cancel a challenge invitation ---
const declineInvite = async (req, res) => {
  const { challengeId } = req.params;
  const userId = req.user.userId;
  try {
    const result = await Challenge.destroy({
      where: {
        id: challengeId,
        status: "pending",
        [Op.or]: [{ challengerId: userId }, { recipientId: userId }],
      },
    });
    if (result === 0)
      return res.status(404).json({ message: "Invitation not found." });
    res.json({ message: "Invitation removed." });
  } catch (error) {
    console.error("Decline Invite Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const getChallengeDetails = async (req, res) => {
  const { challengeId } = req.params;
  try {
    const challenge = await Challenge.findByPk(challengeId, {
      include: [
        {
          model: User,
          as: "challenger",
          attributes: ["displayName", "leetcodeUsername"],
        },
        {
          model: User,
          as: "recipient",
          attributes: ["displayName", "leetcodeUsername"],
        },
      ],
    });
    if (!challenge)
      return res.status(404).json({ message: "Challenge not found." });

    const problemRes = await axios.get(
      `https://leetcode-api-pied.vercel.app/problem/${challenge.problemTitleSlug}`,
    );

    res.json({
      challenge,
      problemDetails: problemRes.data,
    });
  } catch (error) {
    console.error("Get Challenge Details Error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

const submitSolution = async (req, res) => {
  const { challengeId } = req.params;
  const { languageId, code } = req.body;
  const userId = req.user.userId;

  try {
    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge || challenge.status !== "active") {
      return res
        .status(400)
        .json({ message: "This challenge is not active or has ended." });
    }

    const problem = getProblemBySlug(challenge.problemTitleSlug);
    if (!problem) {
      return res
        .status(404)
        .json({ message: "Problem test cases not found in our database." });
    }

    const submissions = problem.testCases.map((testCase) => ({
      language_id: languageId,
      source_code: code,
      stdin: testCase.input,
      expected_output: testCase.output,
    }));

    const judge0Response = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions/batch",
      { submissions },
      {
        headers: {
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    const tokens = judge0Response.data.map((s) => s.token).join(",");

    // Poll for batch results after a delay
    setTimeout(async () => {
      try {
        const resultsRes = await axios.get(
          `https://judge0-ce.p.rapidapi.com/submissions/batch?tokens=${tokens}&fields=*`,
          {
            headers: {
              "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
              "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
            },
          },
        );

        const finalResults = resultsRes.data.submissions;
        const allPassed = finalResults.every((r) => r.status.id === 3); // 3 = Accepted

        await ChallengeSubmission.create({
          challengeId,
          userId,
          language: languageId,
          isCorrect: allPassed,
        });

        if (allPassed && challenge.status === "active") {
          challenge.winnerId = userId;
          challenge.status = "completed";
          await challenge.save();
        } else if (!allPassed) {
          // Accuracy-based scoring: add penalty
          if (challenge.challengerId === userId) {
            challenge.challengerScore += 1;
          } else {
            challenge.recipientScore += 1;
          }
          await challenge.save();
        }

        res.json({ results: finalResults, allPassed });
      } catch (pollError) {
        console.error(
          "Polling Error:",
          pollError.response?.data || pollError.message,
        );
        res.status(500).json({ message: "Error getting judging result." });
      }
    }, 3000);
  } catch (error) {
    console.error("Submission Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error submitting solution." });
  }
};

// --- NEW: Get the status of an active challenge ---
const getChallengeStatus = async (req, res) => {
  const { challengeId } = req.params;
  try {
    const challenge = await Challenge.findByPk(challengeId, {
      include: [
        {
          model: User,
          as: "winner",
          attributes: ["displayName", "leetcodeUsername"],
        },
      ],
    });
    if (!challenge)
      return res.status(404).json({ message: "Challenge not found." });

    // If a winner is declared, the challenge is over
    if (challenge.status === "completed" && challenge.winner) {
      return res.json({ status: "completed", winner: challenge.winner });
    }

    // If the challenge was accepted, it's active
    if (challenge.status === "active") {
      return res.json({ status: "active" });
    }

    // If it's still pending after a timeout (e.g., 5 minutes), count it as a loss for the recipient
    const fiveMinutes = 5 * 60 * 1000;
    if (
      challenge.status === "pending" &&
      new Date() - challenge.createdAt > fiveMinutes
    ) {
      challenge.status = "completed";
      challenge.winnerId = challenge.challengerId; // Challenger wins by default
      await challenge.save();
      return res.json({ status: "expired" });
    }

    res.json({ status: challenge.status });
  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
};
export {
  inviteUser,
  searchProblems,
  getInvites,
  acceptInvite,
  declineInvite,
  getChallengeDetails,
  submitSolution,
  getDailyProblem,
  getChallengeStatus,
};
