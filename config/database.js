const dbConfig = require("../config/database");
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize(
    'scaleedge_lead',
    'root',
    'ashish@11',
    {
       host: 'localhost',
       dialect: 'mysql'
    }
 );
 
sequelize.authenticate().then(() => {
   console.log('Connection has been established successfully.');
}).catch((error) => {
   console.error('Unable to connect to the database: ', error);
});

module.exports = sequelize;

