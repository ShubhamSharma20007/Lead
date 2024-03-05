// models/lead_data.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LeadData = sequelize.define('leadData', {
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lead_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    companyName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    lead_status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    target_status: {
        type: DataTypes.STRING,
        allowNull: false
    },

}, {
    timestamps: false,
    tableName: 'lead_data'
});

module.exports = LeadData;
