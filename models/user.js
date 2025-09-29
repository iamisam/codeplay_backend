import { Sequelize, DataTypes } from "sequelize";
import bcrypt from "bcryptjs";
import sequelize from "../utils/database.js";

const User = sequelize.define(
  "users",
  {
    // Primary Key
    userId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },

    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },

    // Authentication Fields
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true, // Add validation for email format
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    profileVisibility: {
      type: DataTypes.ENUM("public", "private"),
      allowNull: false,
      defaultValue: "public",
    },
    status: {
      type: DataTypes.ENUM("online", "away", "offline"),
      allowNull: false,
      defaultValue: "offline", // Default to offline
    },

    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // LeetCode Profile Fields
    leetcodeUsername: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    realName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    countryName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    school: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    aboutMe: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reputation: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    ranking: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    // Add hooks to automatically hash the password
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        // Hash password on update as well, if it has been changed
        if (user.changed("password")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  },
);

// Add an instance method to compare passwords
User.prototype.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default User;

const AcSubmission = sequelize.define("AcSubmissions", {
  userId: {
    type: Sequelize.INTEGER,
    references: {
      model: "users",
      key: "userId",
    },
  },
  username: {
    type: Sequelize.STRING,
  },
  difficulty: {
    type: Sequelize.ENUM("All", "Easy", "Medium", "Hard"),
    allowNull: false,
  },
  count: {
    type: Sequelize.INTEGER,
  },
  submissions: {
    type: Sequelize.INTEGER,
  },
});

const TotalSubmission = sequelize.define("TotalSubmissions", {
  userId: {
    type: Sequelize.INTEGER,
    references: {
      model: "users",
      key: "userId",
    },
  },
  username: {
    type: Sequelize.STRING,
  },
  difficulty: {
    type: Sequelize.ENUM("All", "Easy", "Medium", "Hard"),
    allowNull: false,
  },
  count: {
    type: Sequelize.INTEGER,
  },
  submissions: {
    type: Sequelize.INTEGER,
  },
});

export { User, AcSubmission, TotalSubmission };
