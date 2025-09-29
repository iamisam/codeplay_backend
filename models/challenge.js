import { DataTypes } from "sequelize";
import sequelize from "../utils/database.js";
import User from "./user.js";

const Challenge = sequelize.define("challenges", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  challengerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "userId" },
  },
  recipientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "userId" },
  },
  problemTitleSlug: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      "pending",
      "accepted",
      "declined",
      "active",
      "completed",
      "forfeited",
    ),
    allowNull: false,
    defaultValue: "pending",
  },
  winnerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: User, key: "userId" },
  },
  challengerScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  recipientScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const ChallengeSubmission = sequelize.define("challengeSubmissions", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  challengeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: Challenge, key: "id" },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "userId" },
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isCorrect: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
});

export { Challenge, ChallengeSubmission };
