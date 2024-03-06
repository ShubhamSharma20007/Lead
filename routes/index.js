var express = require('express');
var router = express.Router();
const sequelize = require("../config/database");
const userModel = require("../models/userModel")
const CustomFormField = require("../models/CustomFormField")
const LeadData = require("../models/LeadData")
const con = require("../config/database");
const bcrypt = require('bcryptjs');
const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const randomString = require('randomstring')
const nodemailer = require('nodemailer');
const isAuth = require('../Middlewares/isAuth');
const selecteModal = require("../models/TargetSelectModel")
const DashboardFieldModal = require("../models/DashBoardFieldName")
const Message = require('../models/message');
const fileUpload = require("express-fileupload");
const path = require('path');
const fs = require('fs');

router.use(fileUpload());

// login get request
router.get("/", function (req, res, next) {
  res.render("login", { title: "scaleedge" });
});

// post router login request
router.post("/login", async (req, res) => {

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Please add email and password" })
    }
    // find user
    const findUser = await userModel.findOne({
      where: {
        [Op.or]: [{ email: email }, { employee_id: email }]
      }
    })
    if (!findUser) {
      return res.status(400).json({ error: "User does not exist" })
    }
    // check password
    const decryptPassword = await bcrypt.compare(password, findUser.password)
    if (!decryptPassword) {
      return res.status(400).json({ error: "Invalid credentials" })
    }
    req.session.user = true;
    req.session.username = findUser.username
    req.session.email = findUser.email
    req.session.user_group = findUser.user_group
    req.session.userImage = findUser.userImage
    res.status(200).json({ success: true, message: "Login successful" });

  } catch (error) {
    return res.status(400).json({ success: false, error: error.message })
  }
})

//sign up get request
router.get("/signup", (req, res) => {
  res.render("register")
})




//lead Managment get request
router.get('/leadManagement', isAuth, async function (req, res, next) {
  try {
    let userGroup = req.session.user_group;
    console.log(userGroup);
    let isAdmin = userGroup === "admin";
    const newLeads = await LeadData.findAll({ where: { target_status: 'New Lead' } });
    const contactInitiation = await LeadData.findAll({ where: { target_status: 'Contact Initiation' } });
    const scheduleFollowUp = await LeadData.findAll({ where: { target_status: 'Schedule Follow Up' } });

    // Fetch other containers dynamically based on unique target statuses
    const otherContainers = await DashboardFieldModal.findAll({
      where: {
        fieldName: {
          [Op.notIn]: ['New Lead', 'Contact Initiation', 'Schedule Follow Up']
        }
      }
    });

    res.render('leadManagement', { newLeads, contactInitiation, scheduleFollowUp, otherContainers, isAdmin: isAdmin });
  } catch (error) {
    console.error('Error fetching lead data:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/fetchDataForContainer/:fieldName', async (req, res) => {
  const { fieldName } = req.params;
  try {
    // Fetch data from LeadData table based on target_status
    const leads = await LeadData.findAll({ where: { target_status: fieldName } });
    // console.log('Fetched data for', fieldName, ':', leads); // Log fetched data
    res.status(200).json(leads);
  } catch (error) {
    console.error(`Error fetching data for ${fieldName}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



router.post('/updateTargetStatus', async (req, res) => {
  const { cardId, newTargetStatus } = req.body;
  try {
    // Update the target_status in the LeadData table based on the cardId
    await LeadData.update({ target_status: newTargetStatus }, { where: { id: cardId } });
    res.sendStatus(200); // Send success response
  } catch (error) {
    console.error('Error updating target status:', error);
    res.status(500).send('Internal Server Error'); // Send error response
  }
});


// logout get request
router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy();
  }
  res.redirect("/");
});

router.get("/customizeLeadform", function (req, res, next) {
  let userGroup = req.session.user_group;
  console.log(userGroup);
  let isAdmin = userGroup === "admin";
  res.render("customizeLeadform", { title: "sumit", isAdmin: isAdmin });
});

// post custom field and alter lead table
router.post("/sendCustomField", async function (req, res, next) {
  try {
    const { labelName, name, divId, type } = req.body;
    // Insert into custom_form_field table
    await CustomFormField.create({
      labelName,
      name,
      divId,
      type
    });

    // Dynamically add a column to the lead_data table based on the labelName
    const columnDefinition = `ALTER TABLE lead_data ADD COLUMN ${labelName.replace(/\s+/g, "")} VARCHAR(255);`;

    await sequelize.query(columnDefinition);

    res.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

//select all custom_form_field
router.get("/sendCustomField", async (req, res) => {
  try {
    // Use Sequelize model to execute the query
    const data = await CustomFormField.findAll();

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

//delete custom field
router.post("/sendCustomField/:id", async (req, res) => {
  const id = req.params.id;

  try {
    // Get the labelName for the div_id
    const customField = await CustomFormField.findOne({
      where: {
        div_id: id
      }
    });

    if (!customField) {
      return res.status(404).json({ success: false, error: "Custom field not found" });
    }

    const labelName = customField.labelName;

    // Delete the custom field from CustomFormField
    await CustomFormField.destroy({
      where: {
        div_id: id
      }
    });

    // Drop the column from the lead_data table
    await sequelize.query(`ALTER TABLE lead_data DROP COLUMN ${labelName.replace(/\s+/g, "")};`);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});


//post lead data 
router.post('/lead_data', function (req, res) {
  const leadData = req.body;
  const customFieldsMap = {
    'leadName': 'lead_name',
    'contactNum': 'number',
    'contactemail': 'email',
    'selectstatus': 'lead_status',
    'targetStatus': ' target_status'
  };

  // Construct SQL query to insert data into lead_data table
  let insertQuery = `INSERT INTO lead_data (`;

  // Prepare column names and values for the SQL query
  const columnNames = [];
  const columnValues = [];

  // Iterate through each field in leadData
  for (const field in leadData) {
    if (leadData.hasOwnProperty(field)) {
      // Map custom field names to fixed field names
      if (customFieldsMap.hasOwnProperty(field)) {
        columnNames.push(customFieldsMap[field]);
      } else {
        columnNames.push(field);
      }
      columnValues.push(`'${leadData[field]}'`);
    }
  }

  insertQuery += columnNames.join(', ');
  insertQuery += `) VALUES (`;
  insertQuery += columnValues.join(', ');
  insertQuery += `);`;

  // Execute the insert query
  con.query(insertQuery, function (error, results) {
    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "Database error" });
    }

  });
  res.status(200).json({ success: true, message: "Lead data inserted successfully" });

});



// POST : Send OTP Vertification 

const otpMap = new Map()
router.post('/send-otp', (req, res) => {
  const email = req.body.email;

  // genrate the a random OTP
  const otp = randomString.generate({
    length: 4,
    charset: 'numeric'
  });

  otpMap.set(email, otp)
  // send the OTP to email 
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "shubhamsharma20007@gmail.com",
      pass: "oewgbwrftpzhteii"
    }
  })
  const mailOptions = {
    from: "shubhamsharma20007@gmail.com",
    to: email,
    subject: "OTP Verification",
    text: "Your OTP is " + otp
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email', error)
    }
    else {
      console.log('Email sent:', info.response)
      res.status(200).json({ message: "OTP sent successfully", otp: otp, success: true })
    }
  })


})


// POST : /otp-value

router.post('/otp-value', (req, res) => {
  const { inputOne, inputSecond, inputThird, inputFour } = req.body;
  // merge the data 
  const str = `${inputOne}${inputSecond}${inputThird}${inputFour}`;
  const lastValue = str.slice(-1); // Extract the last 4 characters
  console.log(lastValue);

})


// post router signup request

router.post("/signup", async (req, res) => {

  try {
    const email = req.body.email;
    const enteredOtp = req.body.otp;
    console.log(enteredOtp)
    const storedOtp = otpMap.get(email);
    console.log(storedOtp)
    if (enteredOtp === storedOtp) {
      otpMap.delete(email);
      const { username, number, password, confirmPassword } = req.body;

      if (!username || !email || !number || !password || !confirmPassword) {
        return res.status(400).json({ error: "Please add all the fields" });
      }

      // check if the password matches the confirm password
      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Password and Confirm Password do not match" });
      }

      // check the number length
      if (number.length !== 10) {
        return res.status(400).json({ error: "Please enter a valid 10 digit number", success: false });
      }

      // check if the user already exists
      const userExist = await userModel.findOne({ where: { email } });
      if (userExist) {
        return res.status(400).json({ error: "User already exists" });
      }

      // hash the password
      const bcryptPassword = await bcrypt.hash(password, 10);

      // create a new user
      const uniqueId = `scaleedge${uuidv4().split("-")[1]}`;
      const newUser = await userModel.create({ username, email, number, password: bcryptPassword, employee_id: uniqueId });

      return res.status(200).json({ success: true, message: "User created successfully", user: newUser });
    } else {
      return res.status(400).json({ success: false, error: "Invalid OTP" });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});




// select dropdown router 
// POST : /selecteModal
// Where  used  : customizeLeadForm
// model  : SelectDataModal

router.post("/selectoption", async (req, res) => {
  try {
    const { dropdownInput } = req.body;
    if (!dropdownInput) {
      return res.status(400).json({ error: "Please enter a valid input" });
    }
    console.log(dropdownInput)
    const modal = await selecteModal.create({
      labelName: dropdownInput,
      value: dropdownInput
    })

    // await sequelize.query(`ALTER TABLE lead_data ADD COLUMN ${dropdownInput.replace(" ","")} VARCHAR(255)`)
    return res.status(200).json({ success: true, message: "Data inserted successfully", data: modal });

  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });

  }
})

// select dropdown router 
// GET : /selecteModal
// Where  used  : customizeLeadForm
// model  : SelectDataModal

router.get("/selectoption", async (req, res) => {
  try {
    // Assuming DashboardFieldModal is imported and available in your code
    const [selecteModalData, dashboardFieldData] = await Promise.all([
      selecteModal.findAll(),
      DashboardFieldModal.findAll()
    ]);

    return res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      selecteModalData: selecteModalData,
      dashboardFieldData: dashboardFieldData
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});




// delete modal field
router.post("/delete-option", async (req, res) => {
  try {
    const id = parseInt(req.query.id); // Parse to integer
    console.log(id)

    // Check if id is NaN (not a number) or less than 1
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Deleting the row
    const deleteField = await selecteModal.destroy({ where: { id: id } });
    if (!deleteField) {
      return res.status(400).json({ success: false, message: "Option not found" });
    }

    return res.status(200).json({ success: true, message: "Option deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, error: error.message });
  }
});



router.get('/userName', async (req, res) => {
  try {
    const users = await userModel.findAll();
    return res.status(200).json({ userName: req.session.username, users })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
})



router.get("/demo", async function (req, res, next) {
  try {
    // Fetch data for different target statuses
    const newLeads = await LeadData.findAll({ where: { target_status: 'New Lead' } });
    const contactInitiation = await LeadData.findAll({ where: { target_status: 'Contact Initiation' } });
    const scheduleFollowUp = await LeadData.findAll({ where: { target_status: 'Schedule Follow Up' } });
    res.render('demo', { newLeads, contactInitiation, scheduleFollowUp });
  } catch (error) {
    console.error('Error fetching lead data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Update lead status route
router.put("/updateLeadStatus/:id", async function (req, res, next) {
  const { id } = req.params;
  const { fieldName } = req.body;

  try {
    const lead = await LeadData.findByPk(id);
    if (!lead) {
      return res.status(404).send('Lead not found');
    }
    lead.target_status = fieldName;
    await lead.save();
    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating lead status:', error);
    res.status(500).send('Internal Server Error');
  }
});


// custom dash boardfield
// POST : /customfield

router.post('/customfield', async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) {
      return res.status(400).json({ error: "Field name is required" });
    }

    // Get the maximum container ID from the database
    const maxContainerId = await DashboardFieldModal.max('containerId');
    let nextContainerId;

    // If maxContainerId is null, start from container4, else increment it by 1
    if (maxContainerId === null) {
      nextContainerId = 'container4';
    } else {
      const containerNumber = parseInt(maxContainerId.replace('container', ''));
      nextContainerId = `container${containerNumber + 1}`;
    }

    const insertData = await DashboardFieldModal.create({ fieldName: value, containerId: nextContainerId });
    return res.status(200).json({ message: "Field added successfully", data: insertData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


router.get('/fetchcontainers', async (req, res) => {
  try {
    const containers = await DashboardFieldModal.findAll();
    res.status(200).json({ containers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/userNamesAndEmails', async (req, res) => {
  try {
    const sessionUsername = req.session.username;
    const sessionImage = req.session.userImage; // Retrieve the session username

    // Fetch users' usernames, emails, and images
    const users = await userModel.findAll({ attributes: ['username', 'email', 'userImage'] });

    // Replace the username with "Me" if it matches the session username
    const modifiedUsers = users.map(user => {
      if (user.username === sessionUsername) {
        return { ...user, username: 'Me', userImage: sessionImage }; // Include session userImage
      }
      return user;
    });

    return res.status(200).json(modifiedUsers);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


router.post('/send', async (req, res) => {
  try {
    // Destructure request body
    const { toId, toName, message } = req.body;

    // Default values for fromId and fromName
    const fromId = req.session.email || 'default_email@example.com'; // Using session email if available, or default value
    const fromName = req.session.username || 'Default User'; // Using session username if available, or default value

    // Create new message
    const newMessage = await Message.create({
      fromId,
      fromName,
      toId,
      toName,
      message
    });

    // Send response
    res.status(201).json(newMessage);
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/messages/:toId', async (req, res) => {
  try {
    const { toId } = req.params;
    const fromId = req.session.email;

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromId: fromId, toId: toId },
          { fromId: toId, toId: fromId }
        ]
      },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Backend route to fetch session email
router.get('/session-email', (req, res) => {
  const sessionEmail = req.session.email;
  const sessionImage = req.session.userImage;
  res.json({ email: sessionEmail, userImage: sessionImage });
});

router.post("/upload", async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  let userImage = req.files.userImage;

  const uploadDir = path.join("public", "userImage");
  console.log(uploadDir,123)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = Date.now() + "_" + userImage.name;
  userImage.mv(path.join(uploadDir, fileName), async (err) => {
    if (err) {
      return res.status(500).send(err);
    }

    try {
      const user = await userModel.findOne({ where: { email: req.session.email } });
      if (user) {
        user.userImage = fileName;
        await user.save();
        res.json({ message: "File uploaded successfully", imageName: fileName });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error updating database:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});


router.get('/usersFetch', async (req, res) => {
  try {
      // Assuming you have access to the user's email stored in the session
      const userEmail = req.session.email;

      // Fetch the user details based on the email
      const user = await userModel.findOne({ where: { email: userEmail } });

      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      // If the user is found, send the user details in the response
      res.json(user);
      
  } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).send("Internal Server Error");
  }
});

router.get('/user/:toId', async (req, res) => {
  try {
    const { toId } = req.params;

    // Fetch user data based on toId
    const userData = await userModel.findOne({ where: { email: toId } });

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});



module.exports = router;
