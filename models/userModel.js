const { DataTypes } = require("sequelize");
const sequelize = require("../config/database")
const userData = sequelize.define('userModel',{
    username:{
        type:DataTypes.STRING,
        allowNull:false
    },
    email:{
        type:DataTypes.STRING,
        allowNull:false,
        trim : true
    },
    number:{
        type:DataTypes.STRING,
        allowNull:false
    },
    password:{
        type:DataTypes.STRING,
        allowNull:false
    },
    employee_id:{
        type :DataTypes.STRING,
        
    }
},{timestamps:false})             

sequelize.sync().then(()=>{
    console.log("user table created")
})
.catch((err)=>{
    console.log(err)
})

module.exports = userData;