const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FlipUser = require('../models/FlipUser');

// Set up Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xls', '.xlsx'];
    const ext = path.extname(file.originalname);
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  },
});

router.get("/", auth, async (req, res) => {
    try {
      // Use all query parameters as filters
      const filters = { ...req.query };
  
      // Fetch filtered users
      const flipUsers = await FlipUser.find(filters);
  
      // Respond with the filtered data
      res.status(200).json({
        success: true,
        data: flipUsers,
      });
    } catch (error) {
      console.error("Error fetching FlipUsers with filters:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch FlipUsers",
      });
    }
  });
  
  router.post("/upload", auth, upload.single('file'), async (req, res) => {
    try {
      // Step 1: Check if the file exists
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
  
      // Step 2: Parse the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0]; // Get the first sheet
      const worksheet = workbook.Sheets[sheetName];
  
      // Convert the worksheet to JSON to inspect the data
      let sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); // Get data as a 2D array
  
      // Step 3: Extract channel names and IDs from the third row
      const channelHeaders = []; // Store channel information
      for (let i = 14; i < sheetData[2].length; i += 2) {
        // Every second column has the channel name and adjacent column has the ID
        if (sheetData[2][i] && sheetData[2][i + 1]) {
          channelHeaders.push({
            name: sheetData[2][i], // Channel name
            id: sheetData[2][i + 1], // Channel ID
          });
        }
      }
  
      console.log("Channel Headers:", channelHeaders);
  
      // Step 4: Remove the first 3 rows (headers or unwanted rows)
      sheetData.shift(); // Remove the first row
      sheetData.shift(); // Remove the second row
      sheetData.shift(); // Remove the third row
  
      // Step 5: Iterate through the remaining rows and create `FlipUser` objects
      const users = [];
      const fileBenutzernames = []; // To track `benutzername` values from the file
  
      for (const row of sheetData) {
        if (row.length < 14) continue; // Skip rows that don't have enough columns
  
        const channels = [];
        for (let i = 0; i < channelHeaders.length; i++) {
          const role = row[14 + i * 2]; // The role is in the same column as the channel name
          if (role && (role.toLowerCase() === "admin" || role.toLowerCase() === "member")) {
            channels.push({
              name: channelHeaders[i].name,
              id: channelHeaders[i].id,
              role: role.toLowerCase(), // Add the role (admin or member)
            });
          }
        }
  
        // Create the user object
        const user = {
          vorname: row[0],
          nachname: row[1],
          benutzername: row[2],
          rolle: row[3],
          email: row[8],
          abteilung: row[9],
          position: row[10],
          standort: row[11],
          telefon: row[12],
          mobil: row[13],
          channels,
        };
  
        users.push(user);
        fileBenutzernames.push(row[2]); // Add `benutzername` to the list
      }
  
      console.log("Parsed Benutzername from file:", fileBenutzernames);
  
      // Step 6: Set `isActive` to false for users not in the file
      await FlipUser.updateMany(
        { benutzername: { $nin: fileBenutzernames } }, // Find users not in the file
        { $set: { isActive: false } } // Set `isActive` to false
      );
  
      // Step 7: Save or update users in the database
      const bulkOps = users.map(user => ({
        updateOne: {
          filter: { benutzername: user.benutzername }, // Find user by `benutzername`
          update: { ...user, isActive: true }, // Update user and ensure `isActive` is set to true
          upsert: true, // Insert if the user does not exist
        },
      }));
  
      await FlipUser.bulkWrite(bulkOps);
  
      res.status(201).json({
        message: "Users updated successfully. Missing users were deactivated.",
        userCount: users.length,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).json({ error: "Failed to process the uploaded file" });
    }
  });
  
module.exports = router;