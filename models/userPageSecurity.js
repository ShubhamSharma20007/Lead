const {DataTypes} = require('sequelize')
const sequelize = require('../config/database')

const UserPageSecurity = sequelize.define('userPageSecurity', {
  userPk:{
    type : DataTypes.STRING,
    allowNull : false
  },
  pagePk:{
    type : DataTypes.STRING,
    allowNull : false
  },
  access_b: {
    type: DataTypes.ENUM('y', 'n'),
    defaultValue: 'y'
  }

})

module.exports = UserPageSecurity;