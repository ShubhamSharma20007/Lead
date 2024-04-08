const {DataTypes} = require('sequelize')
const sequelize = require('../config/database')
    const Product = sequelize.define('products_table', {
        productName:{
            type:DataTypes.STRING,
            allowNull:false
        },
        userId:{
            type:DataTypes.STRING,
            allowNull:false
        },
    
        
    },{timestamps:true})
  
module.exports = Product;