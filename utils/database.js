import Sequelize from "sequelize";

const sequelize = new Sequelize("leet", "isam", "1234", {
  dialect: "mysql",
  host: "localhost",
});

export default sequelize;
