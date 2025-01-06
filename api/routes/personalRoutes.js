const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require("multer");
const path = require("path");
const FlipUser = require("../models/FlipUser");
const Mitarbeiter = require("../models/Mitarbeiter");
const {
  findFlipUserByName,
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignTeamleiterUndMitarbeiter,
} = require("../FlipService");

const TEAMLEITER_CHANNELS = [
  "6dca2f32-d47d-4a6b-a79a-bbf19deb232e",
  "4cf5b96f-2283-4025-bc61-6adc42592de7",
  "d7546ee1-dbba-44ce-a528-5b18a1e7c5e5",
];

const FEST_ANGESTELLT_CHANNELS = [
  "9dcccfd2-ae15-4b3b-ba48-ab490e56fa80",
  "2fc302b0-9776-454c-8514-e847e912801b",
  "5fd52cb1-e21c-4d7c-8cac-0b0d143c7aec",
];

const OFFICE_MA_CHANNELS = [
  "6ca6b7db-30e4-4bfe-9f05-4b997e455274",
  "ecfee8af-7550-41a7-8493-c8b290a22720",
  "730728fb-cc1f-4122-b34e-dd35ff14e79a",
];

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".xls", ".xlsx"];
    const ext = path.extname(file.originalname);
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error("Invalid file type"));
    }
    cb(null, true);
  },
});

// Helper function to convert Excel serial dates to JS dates
const excelDateToJSDate = (serial) => {
  const excelEpoch = new Date(1900, 0, 1);
  return new Date(excelEpoch.getTime() + (serial - 2) * 86400 * 1000); // Adjust for Excel's leap year bug
};

router.get("/flip", auth, async (req, res) => {
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
router.get("/mitarbeiter", auth, async (req, res) => {
  try {
    // Use all query parameters as filters
    const filters = { ...req.query };

    // Fetch filtered users
    const mitarbeiter = await Mitarbeiter.find(filters);

    // Respond with the filtered data
    res.status(200).json({
      success: true,
      data: mitarbeiter,
    });
  } catch (error) {
    console.error("Error fetching Mitarbeiter with filters:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Mitarbeiter",
    });
  }
});
router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Extract channel headers (row 3)
    const channelHeaders = [];
    for (let i = 14; i < sheetData[2].length; i += 2) {
      const channelName = sheetData[2][i];
      const channelId = sheetData[2][i + 1];
      if (channelName && channelId) {
        channelHeaders.push({ name: channelName.trim(), id: channelId.trim() });
      }
    }
    console.log("Extracted Channel Headers:", channelHeaders);

    // Process users starting from row 4
    const users = [];
    const fileBenutzernames = [];

    for (const row of sheetData.slice(3)) {
      if (row.length < 14) continue;

      const channels = [];
      for (let i = 14; i < row.length; i += 2) {
        const role = row[i];
        const channelIndex = (i - 14) / 2; // Match to channelHeaders index

        if (
          role &&
          channelHeaders[channelIndex] &&
          (role.toLowerCase() === "admin" || role.toLowerCase() === "member")
        ) {
          channels.push({
            name: channelHeaders[channelIndex].name,
            id: channelHeaders[channelIndex].id,
            role: role.toLowerCase(),
          });
        }
      }

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
      fileBenutzernames.push(row[2]);
    }

    await FlipUser.updateMany(
      { benutzername: { $nin: fileBenutzernames } },
      { $set: { isActive: false } }
    );

    const bulkOps = users.map((user) => ({
      updateOne: {
        filter: { benutzername: user.benutzername },
        update: { ...user, isActive: true },
        upsert: true,
      },
    }));

    await FlipUser.bulkWrite(bulkOps);

    for (const user of users) {
      const flipUser = await FlipUser.findOne({
        benutzername: user.benutzername,
      });
      if (flipUser) {
        const isTeamleiter = user.channels.some((channel) =>
          TEAMLEITER_CHANNELS.includes(channel.id)
        );
        const isFestAngestellt = user.channels.some((channel) =>
          FEST_ANGESTELLT_CHANNELS.includes(channel.id)
        );
        const isOfficeMA = user.channels.some((channel) =>
          OFFICE_MA_CHANNELS.includes(channel.id)
        );

        // Update or create Mitarbeiter
        await Mitarbeiter.findOneAndUpdate(
          { flipRef: flipUser._id },
          {
            vorname: user.vorname,
            nachname: user.nachname,
            email: user.email,
            standort: user.standort,
            isActive: true, // Ensure active on import
            isTeamleiter,
            isFestAngestellt,
            isOfficeMA,
            flipRef: flipUser._id,
          },
          { upsert: true, new: true }
        );
      }
    }

    // Collect all valid flipRefs from imported users
    const validFlipRefs = await FlipUser.find({
      benutzername: { $in: fileBenutzernames },
    }).distinct("_id");

    // Deactivate only those Mitarbeiter not in the current import list
    await Mitarbeiter.updateMany(
      { flipRef: { $nin: validFlipRefs } },
      { isActive: false }
    );

    res.status(201).json({
      message: "Users and Mitarbeiter updated successfully.",
      userCount: users.length,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Failed to process the uploaded file" });
  }
});

router.post(
  "/upload-teamleiter",
  auth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }

      // Read the uploaded Excel file
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      const headers = data[0];
      const rows = data.slice(1);

      // Ensure headers contain necessary columns
      if (headers.length < 8) {
        return res.status(400).send("Invalid file format.");
      }

      // Add a new column for `REPORT_GEFUNDEN`
      headers.push("REPORT_GEFUNDEN");

      const processedRows = [];
      const personalNrToRowsMap = {};

      // Helper function to convert Excel serial date to JavaScript date
      const excelDateToJSDate = (serial) => {
        const excelEpoch = new Date(1900, 0, 1); // Excel epoch starts from Jan 1, 1900
        return new Date(excelEpoch.getTime() + (serial - 2) * 86400 * 1000); // Adjust for Excel's leap year bug
      };

      // Group rows by `personalnr`
      for (const row of rows) {
        if (!row[3]) {
          processedRows.push(row); // Skip rows without `personalnr`
          continue;
        }
        const personalnr = row[3];
        if (!personalNrToRowsMap[personalnr]) {
          personalNrToRowsMap[personalnr] = [];
        }
        personalNrToRowsMap[personalnr].push(row);
      }

      // Fetch all unique Mitarbeiter by personalnr
      const uniquePersonalNrs = Object.keys(personalNrToRowsMap);
      const mitarbeiterDocs = await Mitarbeiter.find({
        personalnr: { $in: uniquePersonalNrs },
      }).populate("eventreports", "datum");

      const personalNrToMitarbeiterMap = {};
      mitarbeiterDocs.forEach((mitarbeiter) => {
        personalNrToMitarbeiterMap[mitarbeiter.personalnr] = mitarbeiter;
      });

      // Process each row group
      for (const personalnr of uniquePersonalNrs) {
        const mitarbeiter = personalNrToMitarbeiterMap[personalnr];
        const rowsForMitarbeiter = personalNrToRowsMap[personalnr];

        // Prepare all event report dates for quick lookup
        const eventReportDates = new Set(
          mitarbeiter?.eventreports?.map((report) =>
            new Date(report.datum).toDateString()
          )
        );

        // Process each row for this Mitarbeiter
        rowsForMitarbeiter.forEach((row) => {
          let excelDate;
          const date = row[0];

          // Convert Excel date to JS date
          if (typeof date === "number") {
            excelDate = excelDateToJSDate(date);
          } else if (typeof date === "string") {
            excelDate = new Date(date);
          }

          if (!excelDate || isNaN(excelDate)) {
            row.push(0); // Mark as no event report found
            processedRows.push(row);
            return;
          }

          // Format date as `dd.mm.yyyy`
          const formattedDate = `${excelDate
            .getDate()
            .toString()
            .padStart(2, "0")}.${(excelDate.getMonth() + 1)
            .toString()
            .padStart(2, "0")}.${excelDate.getFullYear()}`;
          row[0] = formattedDate;

          // Check if the date matches any event report
          const rowDateString = excelDate.toDateString();
          const eventReportFound = eventReportDates.has(rowDateString) ? 1 : 0;
          row.push(eventReportFound);

          processedRows.push(row);
        });
      }

      // Return headers and processed rows
      res.status(200).json({ headers, rows: processedRows });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);


module.exports = router;
