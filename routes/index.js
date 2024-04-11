var express = require('express');
var router = express.Router();
const sequelize = require("../config/database");
const userModel = require("../models/userModel")
const CustomFormField = require("../models/CustomFormField")
const Contact = require("../models/Contact")
const LeadData = require("../models/LeadData")
const TimeTracker = require("../models/TimeTracker")
const CalendarEvent = require("../models/calendarEvent")
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
const Allroute = require('../models/AllRoutes');
const UserPageSecurity = require('../models/userPageSecurity');
const fileUpload = require("express-fileupload");
const path = require('path');
const hbs = require('hbs');
const ActivityModel = require('../models/Activity')
const Activities = require("../models/Activities")
const fs = require('fs');
const ProductModel = require("../models/Product")
const { google } = require('googleapis');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Initialize Passport.js
router.use(passport.initialize());
router.use(passport.session());
router.use(fileUpload());

// // Passport serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google OAuth 
passport.use(new GoogleStrategy({
  clientID: '770083145761-rb10dmm058o29r8oki31012hb938jj4l.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'http://localhost:4000/auth/google/callback',
  scope: ['profile', 'email', 'https://mail.google.com/'] // Updated scope

}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken;
  profile.refreshToken = refreshToken;

  const email = profile.emails[0].value;
  profile.email = email;

  return done(null, profile);
}));

// login get request
router.get("/", function (req, res, next) {
  res.render("login", { title: "scaleedge" });
});

// Define the formatBytes helper function
hbs.registerHelper('formatBytes', function (bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
});


router.get('/readEmails', ensureAuthenticated, async (req, res) => {
  try {
    const emailId = req.query.id;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailResponse = await gmail.users.messages.get({
      userId: 'me',
      id: emailId,
      format: 'full' // Fetch the full email including attachments
    });

    const email = emailResponse.data;
    const messageId = email.id; // Extract the messageId

    // Extract attachments from the email payload

    // Extract attachments from the email payload
    const attachments = extractAttachments(email.payload);

    res.render('readEmails', { user: req.user, email, attachments, messageId });
  } catch (error) {
    console.error('Error fetching email details:', error);
    res.status(500).send('Error fetching email details');
  }
});



function extractAttachments(payload) {
  const attachments = [];
  if (payload.parts && payload.parts.length) {
    payload.parts.forEach(part => {
      if (part.filename && part.body && part.body.attachmentId) {
        const attachment = {
          filename: part.filename,
          attachmentId: part.body.attachmentId,
          size: part.body.size
        };
        attachments.push(attachment);
      }
    });
  }
  return attachments;
}

router.get('/downloadAttachment', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const attachmentId = req.query.id;

    const attachmentResponse = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: req.query.emailId,
      id: attachmentId
    });


    const attachment = attachmentResponse.data;
    const fileData = Buffer.from(attachment.data, 'base64');

    res.set('Content-Disposition', `attachment;
    filename = "${attachment.filename}"`);
    res.set('Content-Type', attachment.mimeType);
    res.send(fileData);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).send('Error downloading attachment');
  }
});

// Define a Handlebars helper function to format file size
hbs.registerHelper('formatFileSize', function (size) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(2) + ' ' + units[unitIndex];
});

hbs.registerHelper('truncateWords', function (text, maxWords) {
  var words = text.split(' ');
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  } else {
    return text;
  }
});


// Google OAuth route
router.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.readonly']
  })
);



// Import required modules

hbs.registerHelper('formatDate', (dateString) => {
  const date = new Date(parseInt(dateString));
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
  return date.toLocaleDateString('en-US', options);
});


router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      // Merge Google profile data with existing session data
      req.session.user = true;
      req.session.username = req.user.username;
      req.session.email = req.user.email;
      req.session.user_group = req.user.user_group;
      req.session.userImage = req.user.userImage;
      req.session.employee_id = req.user.employee_id;

      // Redirect user to desired page
      res.redirect('/mail-inbox');
    } catch (error) {
      // Handle errors if any
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}


// // Protected route (requires authentication)
// router.get('/mail-inbox', (req, res) => {
//   res.render('inbox');
// })

router.get('/mail-inbox', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch inbox emails
    const inboxResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox', // Query to fetch inbox emails
    });

    const inboxMessages = inboxResponse.data.messages || [];

    // Fetch sent emails
    const sentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:sent', // Query to fetch sent emails
    });

    const sentMessages = sentResponse.data.messages || [];

    // Fetch spam emails
    const spamResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:spam', // Query to fetch spam emails
    });

    const spamMessages = spamResponse.data.messages || [];

    // Fetch important emails
    const importantResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:important', // Query to fetch important emails
    });

    const importantMessages = importantResponse.data.messages || [];

    // Fetch drafts
    const draftsResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:drafts', // Query to fetch drafts
    });

    const draftsMessages = draftsResponse.data.messages || [];

    // Fetch trash emails
    const trashResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:trash', // Query to fetch trash emails
    });

    const trashMessages = trashResponse.data.messages || [];

    // Combine all types of messages
    const allMessages = [...inboxMessages, ...sentMessages, ...spamMessages, ...importantMessages, ...draftsMessages, ...trashMessages];

    // Fetch details of each email
    const emails = await Promise.all(allMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('inbox', { user: req.user, emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).send('Error fetching emails');
  }
});

router.get('/sentEmail', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch sent emails
    const sentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:sent', // Query to fetch sent emails
    });

    const sentMessages = sentResponse.data.messages || [];

    // Fetch details of each sent email
    const sentEmails = await Promise.all(sentMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('sentMail', { user: req.user, sentEmails });
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    res.status(500).send('Error fetching sent emails');
  }
});

router.get('/spamEmail', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch spam emails
    const spamResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:spam', // Query to fetch spam emails
    });

    const spamMessages = spamResponse.data.messages || [];

    // Fetch details of each spam email
    const spamEmails = await Promise.all(spamMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('spamMail', { user: req.user, spamEmails });
  } catch (error) {
    console.error('Error fetching spam emails:', error);
    res.status(500).send('Error fetching spam emails');
  }
});

router.get('/importantEmail', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch important emails
    const importantResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:important', // Query to fetch important emails
    });

    const importantMessages = importantResponse.data.messages || [];

    // Fetch details of each important email
    const importantEmails = await Promise.all(importantMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('importantMail', { user: req.user, importantEmails });
  } catch (error) {
    console.error('Error fetching important emails:', error);
    res.status(500).send('Error fetching important emails');
  }
});

router.get('/drafts', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch drafts
    const draftsResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:draft', // Query to fetch drafts
    });

    const draftsMessages = draftsResponse.data.messages || [];

    // Fetch details of each draft
    const draftsEmails = await Promise.all(draftsMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('drafts', { user: req.user, draftsEmails });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).send('Error fetching drafts');
  }
});

router.get('/trashEmail', ensureAuthenticated, async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch trash emails
    const trashResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:trash', // Query to fetch trash emails
    });

    const trashMessages = trashResponse.data.messages || [];

    // Fetch details of each trash email
    const trashEmails = await Promise.all(trashMessages.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
      return emailResponse.data;
    }));

    res.render('trashMail', { user: req.user, trashEmails });
  } catch (error) {
    console.error('Error fetching trash emails:', error);
    res.status(500).send('Error fetching trash emails');
  }
});



// Define Handlebars helper function to get the subject from headers
hbs.registerHelper('getSenderName', function (headers) {
  const fromHeader = headers.find(header => header.name === 'From');
  if (fromHeader) {
    // Extract sender's name from the "From" header
    const match = fromHeader.value.match(/(.) <.>/);
    return match ? match[1] : fromHeader.value;
  } else {
    return 'Unknown Sender';
  }
});

hbs.registerHelper('parseEmailContent', function (email) {
  const parts = email.payload.parts;
  let messageBody = '';
  if (parts && parts.length) {
    parts.forEach(part => {
      if (part.body && part.body.size > 0) {
        const mimeType = part.mimeType;
        if (mimeType === 'text/plain' || mimeType === 'text/html') {
          messageBody += Buffer.from(part.body.data, 'base64').toString();
        }
      }
    });
  } else {
    // If there are no parts, assume the message body is in the main body of the email
    messageBody = Buffer.from(email.payload.body.data, 'base64').toString();
  }
  return messageBody;
});




// Backend endpoint to fetch email content
router.get('/email/:emailId', ensureAuthenticated, async (req, res) => {
  try {
    const { emailId } = req.params;
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      // Optionally, set expiry_date if available
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.get({ userId: 'me', id: emailId });
    const emailContent = response.data.snippet; // You can customize this to fetch the full email content

    res.json(emailContent);
  } catch (error) {
    console.error('Error fetching email content:', error);
    res.status(500).json({ error: 'Error fetching email content' });
  }
});

// Add this route to handle sending emails
router.post('/sendGmail', ensureAuthenticated, async (req, res) => {
  try {
    const { to, cc, bcc, subject, body } = req.body;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: req.user.accessToken,
      refresh_token: req.user.refreshToken,
      expiry_date: req.user.expiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const attachment = req.files ? req.files.attachment : { mimetype: '', name: '', data: Buffer.from('') };


    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Cc: ${cc || ''}`,
      `Bcc: ${bcc || ''}`,
      '',
      `${body}`
    ];

    const rawEmail = emailLines.join('\n').trim();

    const messageParts = [
      `From: "Your Name" <your-email@gmail.com>`,
      `To: ${to}`,
      `Cc: ${cc || ''}`,
      `Bcc: ${bcc || ''}`,
      `Subject: ${subject || ''}`,
      'Content-Type: multipart/mixed; boundary="boundary"',
      '',
      `--boundary`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      `${body}`,
      `--boundary`,
      `Content-Type: ${attachment.mimetype}; name="${attachment.name}"`,
      'Content-Transfer-Encoding: base64',
      '',
      `${attachment.data.toString('base64')}`,
      `--boundary--`
    ];

    const message = messageParts.join('\n').trim();

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    res.send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send('Error sending email');
  }
});


// Middleware to check if user is authenticated


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
    req.session.employee_id = findUser.employee_id

    res.status(200).json({
      success: true,
      message: "Login successful",
      username: findUser.username,
      email: findUser.email,
      user_group: findUser.user_group,
      userImage: findUser.userImage,
      employee_id: findUser.employee_id
    });

  } catch (error) {
    return res.status(400).json({ success: false, error: error.message })
  }
});

//sign up get request
router.get("/signup", (req, res) => {
  res.render("register")
});




//lead Managment get request
router.get('/leadManagement', isAuth, async function (req, res, next) {
  try {
    let userGroup = req.session.user_group;
    let userEmail = req.session.email; // Assuming email is stored in session
    let username = req.session.username;
    console.log(userGroup);
    let isAdmin = userGroup === "admin";
    let leadFilter = {
      isDeleted: false
    }; // Initialize an empty filter object
    // if (!isAdmin) {
    //   // If user is not admin, filter by their email
    //   leadFilter = { loginEmail: userEmail };
    // }
    const newLeads = await LeadData.findAll({ where: { target_status: 'New Lead', ...leadFilter } });
    const contactInitiation = await LeadData.findAll({ where: { target_status: 'Contact Initiation', ...leadFilter } });
    const scheduleFollowUp = await LeadData.findAll({ where: { target_status: 'Schedule Follow Up', ...leadFilter } });

    // Fetch other containers dynamically based on unique target statuses
    const otherContainers = await DashboardFieldModal.findAll({
      where: {
        fieldName: {
          [Op.notIn]: ['New Lead', 'Contact Initiation', 'Schedule Follow Up']
        }
      }
    });

    res.render('leadManagement', { newLeads, contactInitiation, scheduleFollowUp, otherContainers, isAdmin: isAdmin, username });
  } catch (error) {
    console.error('Error fetching lead data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// router.get('/fetchDataForContainer/:fieldName', isAuth, async (req, res) => {
//   const { fieldName } = req.params;
//   const userGroup = req.session.user_group; // Assuming user group is stored in session
//   const userEmail = req.session.email; // Assuming email is stored in session

//   try {
//     let leadFilter = {};

//     if (userGroup !== "admin" && userEmail) {
//       leadFilter = { loginEmail: userEmail };
//     }

//     // Fetch data from LeadData table based on target_status and user's email
//     const leads = await LeadData.findAll({ where: { target_status: fieldName, ...leadFilter } });
//     res.status(200).json(leads);
//   } catch (error) {
//     console.error(`Error fetching data for ${fieldName}:`, error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

router.get('/fetchDataForContainer/:fieldName', isAuth, async (req, res) => {
  const { fieldName } = req.params;
  const userGroup = req.session.user_group; // Assuming user group is stored in session
  const userEmail = req.session.email; // Assuming email is stored in session

  try {
    let leadFilter = {
      isDeleted: false
    };

    if (userGroup !== "admin" && userEmail) {
      leadFilter.loginEmail = userEmail;
    }

    // Fetch data from LeadData table based on target_status and user's email
    let leads;
    if (fieldName !== "all") {
      leads = await LeadData.findAll({ where: { target_status: fieldName, ...leadFilter } });
    } else {
      leads = await LeadData.findAll({ where: leadFilter });
    }

    // Sort the leads based on the relationship between current and previous fields
    leads.sort((a, b) => {
      // If both leads have the same previous field, prioritize the lead that matches the current field
      if (a.previousField === b.previousField) {
        if (a.fieldName === fieldName) return -1; // a should come before b
        if (b.fieldName === fieldName) return 1; // b should come before a
        return 0; // maintain existing order
      }
      // If the previous field of lead a matches the current field of lead b, prioritize lead a
      else if (a.previousField === fieldName) {
        return -1; // a should come before b
      }
      // If the previous field of lead b matches the current field of lead a, prioritize lead b
      else if (b.previousField === fieldName) {
        return 1; // b should come before a
      }
      // Otherwise, maintain existing order
      else {
        return 0;
      }
    });

    res.status(200).json(leads);
  } catch (error) {
    console.error(`Error fetching data for ${fieldName}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get("/lead-store-data/:id", async (req, res) => {
  try {
    const storeval = await LeadData.findOne({ where: { id: req.params.id } })
    if (!storeval) {
      return res.status(404).json({ error: "lead not found" })
    }
    // for contactPerson condition
    if (storeval) {
      const userIdDetail = await Contact.findOne({
        where: {
          id: storeval.contactId
        }
      })
      return res.status(200).json({ success: true, storeval, userIdDetail })
    }


  } catch (error) {
    return res.status(400).json({ success: false, error: error.message })
  }
})

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

router.get("/customizeLeadform", isAuth, function (req, res, next) {
  let userGroup = req.session.user_group;
  let username = req.session.username
  console.log(userGroup);
  let isAdmin = userGroup === "admin";
  res.render("customizeLeadform", { title: "sumit", isAdmin: isAdmin, username });
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
    return res.status(200).json({ userName: req.session.username, users, emp: req.session.employee_id })
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
    const { value, previousField } = req.body;
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

    const insertData = await DashboardFieldModal.create({ fieldName: value, containerId: nextContainerId, previousField });
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


// Store connected clients
const clients = [];

// SSE route for message updates
router.get('/messages/:toId/stream', async (req, res) => {
  try {
    // Check if session is valid
    if (!req.session || !req.session.email) {
      // Session expired or user not logged in, redirect to "/"
      return res.redirect('/');
    }

    const { toId } = req.params;
    const fromId = req.session.email;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Flush headers before any data is sent
    res.flushHeaders();

    // Add client to the list
    clients.push(res);

    // When the client closes the connection, remove it from the list
    req.on('close', () => {
      const index = clients.indexOf(res);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    });

    // Function to send messages to clients
    const sendMessages = async () => {
      const messages = await Message.findAll({
        where: {
          [Op.or]: [
            { fromId: fromId, toId: toId },
            { fromId: toId, toId: fromId }
          ]
        },
        order: [['createdAt', 'ASC']]
      });

      // Send messages to each connected client
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    };

    // Send messages immediately and then set interval for future updates
    await sendMessages();
    const intervalId = setInterval(sendMessages, 5000); // Update every 5 seconds

    // When the client disconnects, clear the interval
    req.on('end', () => {
      clearInterval(intervalId);
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/user-message/:id', async function (req, res) {
  try {
    const { id } = req.params;
    const { input_val } = req.body;
    const message = await Message.update(
      { message: input_val },
      { where: { id } }
    );
    return res.status(200).json({ success: true, allmessage: message });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
  console.log(uploadDir, 123)
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

router.get('/account', isAuth, async (req, res) => {
  try {
    const userDetails = await userModel.findOne({
      where: {
        email: req.session.email
      }
    });

    res.render('account', { userDetails });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/update-account', async (req, res) => {
  try {
    const { id, username, email, number, address, state, zipCode, country } = req.body;

    // Find the user by ID
    const user = await userModel.findByPk(id);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Update user details
    await user.update({
      username,
      email,
      number,
      address,
      state,
      pincode: zipCode,
      country
    });

    res.status(200).send('User details updated successfully');
  } catch (error) {
    console.error('Error updating user details:', error);
    // Handle error appropriately
    res.status(500).send('Internal Server Error');
  }
});

router.post('/upload-image/:id', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    const { id } = req.params;
    const userImage = req.files.userImage;

    // Use the ID to find the user
    const user = await userModel.findByPk(id);

    if (!user) {
      return res.status(404).send('User not found.');
    }

    // Generate a unique name for the uploaded image
    const imageName = `${Date.now()}_${userImage.name}`;

    // Move the uploaded file to /public/userImage folder
    const uploadPath = path.join('public', 'userImage', imageName);
    await userImage.mv(uploadPath);

    // Update userImage field in the database
    user.userImage = imageName;

    // Save the updated user to the database
    await user.save();
    res.status(200).json('File uploaded!');
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json('Internal Server Error');
  }
});

router.get('/mail', function (req, res) {
  res.render('mailIntegration')
})

router.get('/helpDesk', function (req, res) {
  res.render('helpDesk')
})

router.get('/settings', function (req, res) {
  res.render('settings')
})







router.delete('/mess_delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const delMess = await Message.destroy({ where: { id } });
    if (delMess) {
      return res.status(200).json({ msg: "Message Deleted", success: true });
    } else {
      return res.status(404).json({ msg: "Message not found" });
    } `  `
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

router.get('/report', function (req, res) {
  res.render('report')
})

// router.get('/mail-inbox', function (req, res) {
//   res.render('inbox')
// })



// all routes name
function logRoutes() {
  router.stack.forEach((route) => {
    if (route.route && route.route.path && route.route.methods.get) {
      const path = route.route.path;
      Allroute.destroy({
        truncate: true
      })
      Allroute.create({ page_name: path });
      console.log(path);
    }
  });
}
logRoutes();


// user validate for pages
router.post('/access-denied', async function (req, res) {
  try {
    const { userPk, pagePk, params } = req.body;
    const existingRecord = await UserPageSecurity.findOne({ where: { userPk, pagePk } });

    if (existingRecord) {
      await existingRecord.update({ access_b: params });
      return res.status(200).json({ success: true, message: 'data updated' });
    } else {
      await UserPageSecurity.create({ userPk, pagePk, access_b: params });
      return res.status(200).json({ success: true, message: 'data stored' });
    }
  } catch (error) {
    return res.status(500).json({ success: false });
  }
});


router.get('/access-denied', async (req, res) => {
  try {
    const alldata = await UserPageSecurity.findAll();
    console.log(alldata, 2345678)
    return res.status(200).json({ succcess: true, alldata })
  } catch (error) {
    return res.status(500).json({ success: false })
  }
})

// time tracker get route
router.get('/timetracker', async function (req, res) {
  res.render("Timetracker")
});

router.get('/timetrackerGet', async function (req, res) {
  try {
    const alldata = await TimeTracker.findAll();
    if (alldata.length > 0) {
      return res.status(200).json({ success: true, data: alldata });
    } else {
      return res.status(404).json({ success: false, message: 'No data found' });
    }
  } catch (error) {
    console.error('Error fetching timetracker data:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});



// time tracker update route

router.put("/timetracker/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateField = await TimeTracker.update(req.body, { where: { id } })
    if (updateField) {
      return res.status(200).json({ success: true, message: "data updated", updateField })
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: "internal server error", error })
  }
})



// time tracker post route
router.post('/timetracker', async (req, res) => {
  try {
    const { taskname, startTime, endTime, totalTime } = req.body;

    // Validate the request body
    if (!taskname || !startTime || !endTime || !totalTime) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const timetrackerModel = await TimeTracker.create({
      userId: req.session.employee_id,
      taskName: taskname,
      startTime: startTime,
      endTime: endTime,
      totalTime: totalTime
    });

    return res.status(200).json({ success: true, timetrackerModel });
  } catch (err) {
    console.log('Error creating timetracker record:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// time tracker delete row route
router.delete('/timetracker/:id', async (req, res) => {
  try {
    const { id } = req.params
    const delMess = await TimeTracker.destroy({ where: { id } })
    if (delMess) {
      return res.status(200).json({ msg: "data deleted", success: true })
    }
  } catch (error) {
    return res.status(500).json({ msg: "internal server error", success: false, error })
  }
})


// calendar
router.get("/calendar", (req, res) => {
  res.render("calendar")
})


// calendar event route
router.post("/events", async (req, res) => {
  const { eventname, eventdate } = req.body;
  try {
    const data = await CalendarEvent.create({
      eventdate: new Date(eventdate),
      eventname: eventname,
    });
    console.log(req.body)
    if (!data) {
      return res.status(400).json({ success: false, message: "Data not stored" });
    }
    return res.status(200).json({ success: true, message: "Data stored", data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error", error });
  }
});

router.get('/get-events', async (req, res) => {

  try {
    const allevent = await CalendarEvent.findAll();
    console.log(allevent, 2345678)
    if (allevent.length > 0) {
      return res.status(200).json({ success: true, data: allevent });
    }
    else {
      return res.status(404).json({ success: false, message: 'No data found' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
})

// router.post('/leads', function (req, res) {
//   const leadData = req.body;
//   const customFieldsMap = {
//     'ClientName': 'ClientName',
//     'contactNumber': 'contactNumber',
//     'Stage': 'Stage', // Assuming 'Stage' corresponds to 'selectstatus'
//     'Amount': 'Amount',
//     'DealType': 'DealType',
//     'StartDate': 'StartDate',
//     'EndDate': 'EndDate',
//     'target_status': 'target_status',
//     'responsible_person': 'responsible_person',
//     'Product': 'Product',
//     'companyName': 'companyName',
//     'email': 'email',
//     // You don't need to map 'createdAt' and 'updatedAt' as they are handled by MySQL
//   };

//   // Construct SQL query to insert data into lead_data table
//   let insertQuery = `INSERT INTO leads (`;

//   // Prepare column names and values for the SQL query
//   const columnNames = [];
//   const columnValues = [];

//   // Iterate through each field in leadData
//   for (const field in leadData) {
//     if (leadData.hasOwnProperty(field)) {
//       // Map custom field names to fixed field names
//       if (customFieldsMap.hasOwnProperty(field)) {
//         columnNames.push(customFieldsMap[field]);
//       } else {
//         columnNames.push(field);
//       }
//       columnValues.push(`'${leadData[field]}'`);
//     }
//   }

//   // Add createdAt and updatedAt fields with current timestamp
//   columnNames.push('createdAt', 'updatedAt');
//   const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
//   columnValues.push(`'${currentDate}'`, `'${currentDate}'`);

//   columnNames.push('employee_id', 'loginEmail');
//   columnValues.push(`'${req.session.employee_id}'`, `'${req.session.email}'`);

//   insertQuery += columnNames.join(', ');
//   insertQuery += `) VALUES (`;
//   insertQuery += columnValues.join(', ');
//   insertQuery += `);`;

//   // Execute the insert query
//   con.query(insertQuery, function (error, results) {
//     if (error) {
//       console.error(error);
//       return res.status(500).json({ success: false, error: "Database error" });
//     }

//   });
//   res.status(200).json({ success: true, message: "Lead data inserted successfully" });

// });


// activity route

// router.post("/activity", async (req, res) => {
//   try {
//     const { lead_id, activity } = req.body;
//     const newActivity = await ActivityModel.create({
//       lead_id: lead_id,
//       activity: activity
//     });
//     res.status(201).json({ message: "Activity created successfully", data: newActivity });
//   } catch (error) {
//     console.error("Error creating activity:", error);
//     res.status(500).json({ message: "Failed to create activity" });
//   }
// });

router.post("/activity", async (req, res) => {
  try {
    const { lead_id, activity, dateTime } = req.body;
    const newActivity = await Activities.create({
      lead_id: lead_id,
      activity: activity,
      dateTime: dateTime // Storing dateTime in the database
    });
    res.status(201).json({ message: "Activity created successfully", data: newActivity });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ message: "Failed to create activity" });
  }
});

router.get('/activities/:lead_id', async (req, res) => {
  const lead_id = req.params.lead_id;

  try {
    const activities = await ActivityModel.findAll({
      where: {
        lead_id: lead_id
      }
    });

    res.status(200).json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.post('/filter-contact', async (req, res) => {
  const { contact } = req.body;
  try {
    const alldata = await LeadData.findAll({
      where: {
        companyName: {
          [Op.like]: `%${contact}%`
        }
      }
    });

    const contactdata = await Contact.findAll({
      where: {
        name: {
          [Op.like]: `%${contact}%`
        }
      }
    });

    return res.status(200).json({ success: true, alldata, contactdata });
  } catch (error) {
    return res.status(500).json({ success: false, error });
  }
});



router.post('/contactData', async (req, res) => {
  try {
    const { name, email, mobile, address } = req.body;
    const contactData = await Contact.create({ name, email, mobile, address });
    res.status(201).json({ success: true, message: "Contact data created successfully", data: contactData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to create contact data" });
  }
});


router.post('/leads', async (req, res) => {

  try {
    const {
      companyName,
      Stage,
      Amount,
      EndDate,
      ContactNumber,
      contactId,
      DealType,
      StartDate,
      Source,
      target_status,
      responsible_person,
      loginEmail = req.session.email,
      employee_id = req.session.username
    } = req.body;

    const newLead = await LeadData.create({
      companyName,
      Stage,
      Amount,
      EndDate: EndDate || new Date(),
      ContactNumber,
      DealType,
      StartDate: StartDate || new Date(),
      Source,
      contactId,
      target_status : Stage || 'New Lead',
      responsible_person,
      loginEmail,
      employee_id
    });

    res.status(201).json({ message: 'Lead data added successfully', lead: newLead });
  } catch (err) {
    console.error('Error while adding lead data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.put('/leads/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const {
      companyName,
      Stage,
      Amount,
      EndDate,
      ContactNumber,
      clientName,
      clientEmail,
      clientLocation,
      DealType,
      StartDate,
      Source,
      target_status,
      responsible_person,
      loginEmail,
      employee_id
    } = req.body;

    const leadToUpdate = await LeadData.findByPk(leadId);

    if (!leadToUpdate) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Update lead data with provided values, if provided
    if (companyName) leadToUpdate.companyName = companyName;
    if (Stage) {
      leadToUpdate.Stage = Stage;
      leadToUpdate.target_status = Stage;
    } if (Amount) leadToUpdate.Amount = Amount;
    if (EndDate) leadToUpdate.EndDate = EndDate;
    if (ContactNumber) leadToUpdate.ContactNumber = ContactNumber;
    if (clientEmail) leadToUpdate.clientEmail = clientEmail;
    if (clientLocation) leadToUpdate.clientLocation = clientLocation;
    if (clientName) leadToUpdate.clientName = clientName;
    if (DealType) leadToUpdate.DealType = DealType;
    if (StartDate) leadToUpdate.StartDate = StartDate;
    if (Source) leadToUpdate.Source = Source;
    // if (target_status) leadToUpdate.targetStatus = Stage;
    if (responsible_person) leadToUpdate.responsible_person = responsible_person;
    if (loginEmail) leadToUpdate.loginEmail = loginEmail;
    if (employee_id) leadToUpdate.employee_id = employee_id;

    // update the contact to Contact
    const contact = await Contact.findByPk(leadToUpdate.contactId);
    if (contact) {
      contact.name = leadToUpdate.companyName;
      contact.email = leadToUpdate.clientEmail;
      contact.mobile = leadToUpdate.ContactNumber;
      contact.address = leadToUpdate.clientLocation;
      await contact.save();
    }

    await leadToUpdate.save();

    return res.status(200).json({ message: 'Lead data updated successfully', lead: leadToUpdate });
  } catch (err) {
    console.error('Error while updating lead data:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.post('/activities', async (req, res) => {
  try {
    const { lead_id, activity, dateTime, activityStatus } = req.body;

    const newActivity = await Activities.create({
      lead_id,
      activity,
      dateTime,
      activityStatus: "Planned"
    });

    res.status(201).json(newActivity);
  } catch (error) {
    // If an error occurs, send an error response
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Define a route to fetch data based on lead_id
router.get('/activity/:lead_id', async (req, res) => {
  const { lead_id } = req.params;

  try {
    const activities = await Activities.findAll({
      where: {
        lead_id: lead_id
      }
    });

    if (activities) {
      res.status(200).json(activities);
    } else {
      res.status(404).json({ message: 'No activities found for the given lead_id' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/activities/:id/update-status', async (req, res) => {
  const { id } = req.params;
  const { activityStatus } = req.body;

  try {
    const activity = await Activities.findByPk(id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    activity.activityStatus = activityStatus;
    await activity.save();

    return res.status(200).json({ message: 'Activity status updated successfully', activity });
  } catch (error) {
    console.error('Error updating activity status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leadsDataForListView', async (req, res) => {
  try {
    let userGroup = req.session.user_group;
    let userEmail = req.session.email; // Assuming email is stored in session
    let isAdmin = userGroup === "admin";

    if (isAdmin) {
      const leads = await LeadData.findAll();
      res.json(leads);
    } else {
      const leads = await LeadData.findAll({
        where: {
          loginEmail: userEmail
        }
      });
      res.json(leads);
    }
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/customfields/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Find the custom field by Id
    const customField = await DashboardFieldModal.findByPk(id);

    if (!customField) {
      return res.status(404).json({ message: 'Custom field not found' });
    }

    // Delete the custom field
    await customField.destroy();

    return res.status(200).json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/customfields/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { fieldName } = req.body;

    let customField = await DashboardFieldModal.findByPk(id);

    if (!customField) {
      return res.status(404).json({ message: 'Custom field not found' });
    }

    const oldFieldName = customField.fieldName;

    customField = await customField.update(req.body);

    await LeadData.update(
      { target_status: fieldName },
      { where: { target_status: oldFieldName } }
    );

    return res.status(200).json({ message: 'Custom field updated successfully', customField });
  } catch (error) {
    console.error('Error updating custom field:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});


router.delete('/leads/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const lead = await LeadData.findByPk(id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await lead.update({ isDeleted: true });

    return res.status(200).json({ message: 'Lead marked as deleted successfully' });
  } catch (error) {
    console.error('Error marking lead as deleted:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/filter-responsible-person', async (req, res) => {
  const { contact } = req.body;
  try {
    const alldataperson = await userModel.findAll({
      where: {
        username: {
          [Op.like]: `%${contact}%`
        }
      }
    });

    return res.status(200).json({ success: true, alldataperson });
  } catch (error) {
    return res.status(500).json({ success: false, error });
  }
});


router.put('/activitiesforLeads/:id', async (req, res) => {

  const { id } = req.params;
  const { activity, dateTime, activityStatus } = req.body;

  try {
    const activityToUpdate = await Activities.findByPk(id);

    if (!activityToUpdate) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Update the activity attributes, excluding lead_id
    activityToUpdate.activity = activity;
    activityToUpdate.dateTime = dateTime;
    activityToUpdate.activityStatus = activityStatus;

    // Save the updated activity
    await activityToUpdate.save();

    return res.status(200).json(activityToUpdate);
  } catch (error) {
    console.error('Error updating activity:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Product table product
router.post('/product-add', async (req, res) => {
  try {
    const { products } = req.body;
    const userId = req.session.employee_id;
    const uniqueProductNames = new Set(products.map(({ productName }) => productName));
    [...uniqueProductNames].forEach(async (item) => {
      const exist = await ProductModel.findOne({
        where: {
          productName: item,
        },
      })
      if (exist) {
        return console.log('value exist')
      }
    })
    const uniqueProductObjects = [...uniqueProductNames].map(productName => ({ productName, userId }));
    // return console.log(uniqueProductObjects)
    const product_table = await ProductModel.bulkCreate(uniqueProductObjects);
    return res.status(200).json({ success: true, message: "Product added successfully", product_table })
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: "Failed to extract product names" });
  }
});


router.post("/product-list", async (req, res) => {
  try {
    const { productName } = req.body;
    const allPro = await ProductModel.findAll({
      where: {
        productName: {
          [Op.like]: `%${productName}%`
        }
      }
    });

    const uniqueProductNames = [];
    const productNameSet = new Set();
    allPro.forEach(product => {
      if (!productNameSet.has(product.productName)) {
        productNameSet.add(product.productName)
        uniqueProductNames.push(product)
      }
    })
    return res.status(200).json({ success: true, message: "Product list", allPro: uniqueProductNames });
  } catch (error) {
    return res.status(400).json({ success: false, message: "Failed to get product list" });
  }
})





module.exports = router;
