import { DataTypes } from "sequelize";
import sequelize from "../utils/database.js";
import User from "./user.js";

const Friendship = sequelize.define("friendships", {
  friendshipId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "users",
      key: "userId",
    },
  },
  recipientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "users",
      key: "userId",
    },
  },
  status: {
    type: DataTypes.ENUM("pending", "accepted", "declined", "blocked"),
    allowNull: false,
    defaultValue: "pending",
  },
});

User.belongsToMany(User, {
  as: "Friends",
  through: Friendship,
  foreignKey: "requesterId",
  otherKey: "recipientId",
});

export default Friendship;
