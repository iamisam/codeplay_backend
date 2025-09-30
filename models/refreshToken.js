import { DataTypes } from "sequelize";
import sequelize from "../utils/database.js";
import User from "./user.js";

const RefreshToken = sequelize.define(
  "refreshTokens",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "userId",
      },
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdByIp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revokedByIp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    replacedByToken: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

User.hasMany(RefreshToken, { foreignKey: "userId" });
RefreshToken.belongsTo(User, { foreignKey: "userId" });

RefreshToken.prototype.isActive = function () {
  return !this.revokedAt && this.expires > new Date();
};

export default RefreshToken;
