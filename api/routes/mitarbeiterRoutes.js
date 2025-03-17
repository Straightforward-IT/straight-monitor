const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require("multer");
const path = require("path");
const Mitarbeiter = require("../models/Mitarbeiter");
const FlipUser = require("../models/Classes/FlipUser");
const storage = multer.memoryStorage();
const { assignFlipTask, assignFlipUserGroups, getFlipUsers, getFlipUserGroups, getFlipUserGroupAssignments, flipUserRoutine } = require("../FlipService");
const asyncHandler = require("../middleware/AsyncHandler");

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

router.get("/flip", auth, asyncHandler(async (req, res) => {
      const data = await getFlipUsers(req.query);   
      res.status(200).json(data);
}));

router.get("/flip/user-group-assignments", asyncHandler(async (req, res) => {
  const data = await getFlipUserGroupAssignments(req.query);
  res.status(200).json(data);
}));

router.get("/mitarbeiter", auth, asyncHandler(async (req, res) => {

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
}));

router.get("/initialRoutine", auth, asyncHandler(async (req, res) => {
  const data = await flipUserRoutine();
  res.status(200).json(data);
}));

router.post(
  "/upload-teamleiter",
  auth,
  upload.single("file"),
  asyncHandler(
  async (req, res) => {
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
  }
));

router.post("/assignTask", auth, asyncHandler( async (req, res) => {
      const response = await assignFlipTask(req); // Pass the entire request object
      res.status(200).json({
          success: true,
          data: response,
      });
}));

router.post("/create", auth, asyncHandler(async (req, res) => {
  let { asana_id, first_name, last_name, email, role, primary_user_group_id, profile, user_group_ids } = req.body;
  let status = "ACTIVE";
  role = role || "USER";

  try {
      // ✅ 1. Create and save Mitarbeiter in the database
      const mitarbeiter = new Mitarbeiter({ 
          asana_id, 
          vorname: first_name, 
          nachname: last_name, 
          email 
      });
      await mitarbeiter.save();

      // ✅ 2. Create FlipUser instance
      const flipUser = new FlipUser({
          external_id: mitarbeiter._id.toString(),
          first_name,
          last_name,
          email,
          status,
          benutzername: email,
          rolle: role,
          profile,
          primary_user_group_id 
      });

      // ✅ 3. Call Flip API to create user
      const createdFlipUser = await flipUser.create();
      await createdFlipUser.setDefaultPassword();

      // ✅ 4. Update Mitarbeiter with FlipUser ID
      mitarbeiter.flip_id = createdFlipUser.id;
      await mitarbeiter.save();

      // ✅ 5. Assign Flip user to user groups
      if (user_group_ids?.length) {
          await assignFlipUserGroups({
              body: {
                  items: user_group_ids.map(groupId => ({
                      user_id: createdFlipUser.id,
                      user_group_id: groupId
                  }))
              }
          });
      }

      // ✅ 6. Assign initial Flip Task
      await assignFlipTask({
          body: {
              title: `Aufgabe erhalten: Flip Profil einrichten 😎`,
              recipients: [{ id: createdFlipUser.id, type: "USER" }],
              description: `<p>Gehe auf „<strong>Menü</strong>“ und tippe oben links auf den Kreis. Wenn du in den Einstellungen angekommen bist, tippst du auf deinen Namen und dann oben rechts auf „<strong>Bearbeiten</strong>“</p>
                            <p>📋 Wähle ein Profilbild aus auf dem man dich erkennt ( und mit dem du dich wohlfühlst )</p>
                            <p>📋 Im Absatz 'Über Mich' kannst du Leuten mitteilen wer du bist</p>
                            <p>📋 Du kannst auch deine Telefonnummer hinzufügen. Wenn du diese nicht öffentlich teilen möchtest ist das vollkommen okay</p>`
          }
      });

      res.status(201).json({ message: "Flip user created successfully", flipUser: createdFlipUser });
  } catch (error) {
      console.error("❌ Error in createUserRequest:", error.message);
      res.status(500).json({ message: "Error creating Flip user", error: error.message });
  }
}));

router.get("/user-groups", auth, asyncHandler(async (req, res) => {
    const data = await getFlipUserGroups(req.query);
    res.status(200).json(data);
}));

router.post("/user-groups-assign", auth, asyncHandler(async (req, res) => {
  const data = await assignFlipUserGroups(req);
  res.status(200).json(data);
}));

module.exports = router;
