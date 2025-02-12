const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require("multer");
const path = require("path");
const Mitarbeiter = require("../models/Mitarbeiter");
const FlipUser = require("../models/Classes/FlipUser");
const storage = multer.memoryStorage();
const { assignFlipTask, getFlipUsers, getFlipUserGroups, flipUserRoutine } = require("../FlipService");

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

router.get("/flip", auth, async (req, res) => {
  try {
      const data = await getFlipUsers(req.query);
      
      res.status(200).json(data);
  } catch (err) {
      console.error("Error fetching Flip users:", err.response ? err.response.data : err.message);
      res.status(500).json({ error: "Failed to fetch Flip users" });
  }
});


router.get("/mitarbeiter", auth, async (req, res) => {
  try {
    const filters = { ...req.query };
    const mitarbeiter = await Mitarbeiter.find(filters).populate([
      { path: "laufzettel_received", select: "_id name" },
      { path: "laufzettel_submitted", select: "_id name" },
      { path: "eventreports", select: "_id title" },
      { path: "evaluierungen_received", select: "_id score" },
      { path: "evaluierungen_submitted", select: "_id score" }
  ]);   
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

router.get("/initialRoutine", auth, async (req, res) => {
try{
  const data = await flipUserRoutine();
  res.status(200).json(data);
} catch(error) {
  console.error("Error running routine", error);
  res.status(500).json({
    success: false,
    error: "Failed to run",
  });
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
      const nachnameToRowsMap = {};

      // Helper function to convert Excel serial date to JavaScript date
      const excelDateToJSDate = (serial) => {
        const excelEpoch = new Date(1900, 0, 1); // Excel epoch starts from Jan 1, 1900
        return new Date(excelEpoch.getTime() + (serial - 2) * 86400 * 1000); // Adjust for Excel's leap year bug
      };

      // Group rows by `Nachname`
      for (const row of rows) {
        if (!row[1]) { // Check if `Nachname` exists
          processedRows.push(row); // Skip rows without `Nachname`
          continue;
        }
        const nachname = row[1];
        if (!nachnameToRowsMap[nachname]) {
          nachnameToRowsMap[nachname] = [];
        }
        nachnameToRowsMap[nachname].push(row);
      }

      // Fetch all unique Mitarbeiter by Nachname
      const uniqueNachnamen = Object.keys(nachnameToRowsMap);
      
      const mitarbeiterDocs = await Mitarbeiter.find({
        nachname: { $in: uniqueNachnamen },
      }).populate("eventreports", "datum");
      console.log(mitarbeiterDocs);
      const nachnameToMitarbeiterMap = {};
      mitarbeiterDocs.forEach((mitarbeiter) => {
        nachnameToMitarbeiterMap[mitarbeiter.nachname] = mitarbeiter;
      });

      // Process each row group
      for (const nachname of uniqueNachnamen) {
        const mitarbeiter = nachnameToMitarbeiterMap[nachname];
        const rowsForMitarbeiter = nachnameToRowsMap[nachname];

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

router.post("/assignTask", auth, async (req, res) => {
  try {
      const response = await assignFlipTask(req); // Pass the entire request object

      res.status(200).json({
          success: true,
          data: response,
      });
  } catch (err) {
      console.error("Error assigning Flip Task:", err);
      res.status(500).json({
          success: false,
          error: "Failed to create Task",
          details: err.message,
          body: req.body
      });
  }
});

router.post("/create", auth, async (req, res) => {
  try {
      let { asana_id, first_name, last_name, email, role, primary_user_group_id, profile } = req.body;
      let status = "ACTIVE";
      role = role || "USER";
      // Create and save Mitarbeiter
      const mitarbeiter = new Mitarbeiter({ asana_id, vorname: first_name, nachname: last_name, email });
      await mitarbeiter.save();

      // Create FlipUser instance
      const flipUser = new FlipUser({
          external_id: mitarbeiter._id.toString(),
          first_name,
          last_name,
          email,
          status,
          benutzername: email,
          rolle: role,
          profile,
          primary_user_group: { id: primary_user_group_id }
      });

      // Call Flip API to create user
      const createdFlipUser = await flipUser.create();
      await createdFlipUser.setDefaultPassword();
      mitarbeiter.flip_id = createdFlipUser.id;
      mitarbeiter.save();

      // Assign initial Flip Task
      await assignFlipTask({
        body: {
          title: `Aufgabe erhalten: Flip Profil einrichten 😎`,
          recipients: [{
            id: createdFlipUser.id,
            type: "USER"
          }],
          description: `<p>Gehe auf „<strong>Menü</strong>“ und tippe oben links auf den Kreis. Wenn du in den Einstellungen angekommen bist, tippst du auf deinen Namen und dann oben rechts auf „<strong>Bearbeiten</strong>“</p><p><br></p><p>📋 Wähle ein Profilbild aus auf dem man dich erkennt ( und mit dem du dich wohlfühlst ) </p><p>📋 Schreibe rein in welchem Bereich [ Logistik / Service ] du zukünftig arbeitest</p><p>📋 Setze gerne auch deine Telefonnummer. Wenn du diese nicht öffentlich teilen möchtest ist das vollkommen okay</p>`,
        }
      });

      res.status(201).json({ message: "Flip user created successfully", flipUser: createdFlipUser });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user-groups", auth, async (req, res) => {
  try{
    const data = await getFlipUserGroups(req.query);

    res.status(200).json(data);

  } catch(err) {
      console.error("Error fetching Flip user-groups:", err.response ? err.response.data : err.message);
      res.status(500).json({ error: "Failed to fetch Flip user-groups" });
  }
});


module.exports = router;
