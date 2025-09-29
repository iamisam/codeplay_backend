import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import sequelize from "./utils/database.js";
import dotenv from "dotenv";

// dotenv
dotenv.config();

// model imports
import { User, AcSubmission, TotalSubmission } from "./models/user.js";
import Friendship from "./models/friendship.js";
import RefreshToken from "./models/refreshToken.js";
import { Challenge, ChallengeSubmission } from "./models/challenge.js";

// route handler imports
import authRoutes from "./routes/auth.js";
import tokenRoutes from "./routes/token.js";
import testRoute from "./routes/test.js";
import userRoutes from "./routes/user.js";
import friendshipRoutes from "./routes/friendship.js";
import accountRoutes from "./routes/account.js";
import challengeRoutes from "./routes/challenge.js";

const app = express();
const PORT = process.env.PORT || 3000;

User.hasMany(RefreshToken, { foreignKey: "userId" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });
User.hasMany(AcSubmission, { as: "acSubmissions", foreignKey: "userId" });
User.hasMany(TotalSubmission, { as: "totalSubmissions", foreignKey: "userId" });

Friendship.belongsTo(User, { as: "requester", foreignKey: "requesterId" });
Friendship.belongsTo(User, { as: "recipient", foreignKey: "recipientId" });

User.belongsToMany(User, {
  as: "recipient",
  through: Friendship,
  foreignKey: "requesterId",
  otherKey: "recipientId",
});
User.belongsToMany(User, {
  as: "requester",
  through: Friendship,
  foreignKey: "recipientId",
  otherKey: "requesterId",
});

User.hasMany(Challenge, { as: "challengesSent", foreignKey: "challengerId" });
User.hasMany(Challenge, {
  as: "challengesReceived",
  foreignKey: "recipientId",
});
Challenge.belongsTo(User, { as: "challenger", foreignKey: "challengerId" });
Challenge.belongsTo(User, { as: "recipient", foreignKey: "recipientId" });
Challenge.belongsTo(User, { as: "winner", foreignKey: "winnerId" });

Challenge.hasMany(ChallengeSubmission, { foreignKey: "challengeId" });
ChallengeSubmission.belongsTo(Challenge, { foreignKey: "challengeId" });
User.hasMany(ChallengeSubmission, { foreignKey: "userId" });
ChallengeSubmission.belongsTo(User, { foreignKey: "userId" });

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173"); // Or '*' to allow any origin
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(bodyParser.json());
app.use(cookieParser());
app.set("trust proxy", 1);

app.use("/api/auth", authRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/test", testRoute);
app.use("/api/user", userRoutes);
app.use("/api/friends", friendshipRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/challenge", challengeRoutes);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    await sequelize.sync();
    console.log("All models were synchronized successfully.");

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to the database or start server:", error);
  }
};

startServer();
