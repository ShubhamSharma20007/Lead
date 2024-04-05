const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");


const CalendarEvent = sequelize.define("CalendarEvent", {
    eventname:{
        type:DataTypes.STRING
    },
    eventdate:{
        type:DataTypes.DATEONLY
    }
},{timestamps:true})

module.exports = CalendarEvent