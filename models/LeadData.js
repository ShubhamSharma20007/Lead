// // models/lead_data.js
// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/database");
// const LeadData = sequelize.define('leadData', {
//     Id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true,
//         autoIncrement: true
//     },
//     ClientName: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     email:{
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     contactNumber:
//     {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     Stage: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     Amount: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         defaultValue: 0
//     },
//     DealType: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     StartDate: {
//         type: DataTypes.DATE,
//         allowNull: false
//     },
//     EndDate: {
//         type: DataTypes.DATE,
//         allowNull: false
//     },
//     target_status: {
//         type: DataTypes.STRING,
//         allowNull: false,
//         defaultValue:"New Lead"
//     },
//     responsible_person: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     Product: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     companyName:{
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     loginEmail:{
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     employee_id: {
//         type: DataTypes.STRING,
//         allowNull: false
//     },
//     createdAt: {
//         type: DataTypes.DATE,
//         defaultValue: DataTypes.NOW // Use the current timestamp as the default value
//     },
//     updatedAt: {
//         type: DataTypes.DATE,
//         defaultValue: DataTypes.NOW // Use the current timestamp as the default value
//     }

// }, {
//     // timestamps: true,
//     tableName: 'Leads'
// });

// module.exports = LeadData;

// models/lead_data.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const LeadData = sequelize.define('leadData', {
    Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    companyName: {
        type: DataTypes.STRING,
    },
    Stage:{
        type: DataTypes.STRING,
    },
    Amount:
    {
        type: DataTypes.STRING,
    },
    EndDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    ContactNumber: {
        type: DataTypes.STRING,
        defaultValue: '0' // String default value
    },
    DealType: {
        type: DataTypes.STRING,
    },
    StartDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    Source:{
        type: DataTypes.STRING,
    },
    target_status: {
        type: DataTypes.STRING,
        defaultValue:"New Lead"
    },
    responsible_person: {
        type: DataTypes.STRING,
        allowNull: false
    },
    loginEmail:{
        type: DataTypes.STRING,
        allowNull: false
    },
    employee_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false // Default value is false (not deleted)
    },
    updatedTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW 
    },
    contactId:{
        type: DataTypes.STRING,
        defaultValue :0
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW 
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW 
    }

}, {
    tableName: 'Leads'
});

module.exports = LeadData;


