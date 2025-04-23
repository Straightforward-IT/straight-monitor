const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require("multer");
const path = require("path");
const Mitarbeiter = require("../models/Mitarbeiter");
const FlipUser = require("../models/Classes/FlipUser");
const { sendMail } = require("../EmailService");
const storage = multer.memoryStorage();
const {
  assignFlipTask,
  assignFlipUserGroups,
  getFlipUsers,
  getFlipUserGroups,
  getFlipUserGroupAssignments,
  findFlipUserById,
  flipUserRoutine,
  asanaTransferRoutine
} = require("../FlipService");
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

router.get(
  "/flip",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getFlipUsers(req.query);
    res.status(200).json(data);
  })
);

router.get(
  "/flip/user-group-assignments",
  asyncHandler(async (req, res) => {
    const data = await getFlipUserGroupAssignments(req.query);
    res.status(200).json(data);
  })
);

router.get(
  "/mitarbeiter",
  auth,
  asyncHandler(async (req, res) => {
    const filters = { ...req.query };
    const mitarbeiter = await Mitarbeiter.find(filters).populate([
      { path: "laufzettel_received", select: "_id name" },
      { path: "laufzettel_submitted", select: "_id name" },
      { path: "eventreports", select: "_id title" },
      { path: "evaluierungen_received", select: "_id score" },
      { path: "evaluierungen_submitted", select: "_id score" },
    ]);
    res.status(200).json({
      success: true,
      data: mitarbeiter,
    });
  })
);

router.get(
  "/initialRoutine",
  auth,
  asyncHandler(async (req, res) => {
    const data = await flipUserRoutine();
    res.status(200).json(data);
  })
);

router.get("/asanaRoutine", auth, asyncHandler(async (req, res) => {
  const sections = [{id: "1207021175334609", name: "Hamburg"}, {id: "1205091014657240", name: "Berlin"}, {id: "1208816204908538", name: "Köln"}];
  for(const section of sections) {
    await asanaTransferRoutine(section.id, section.name);
  }
  res.status(200).json();
}));

router.get("/missingAsanaRefs", auth, asyncHandler(async (req, res) => {
  const result = await Mitarbeiter.find({
    $or: [
      { asana_id: null },
      { asana_id: "" },
      { asana_id: { $exists: false } }
    ]
  });

  const active = result.filter(m => m.isActive === true);
  const inactive = result.filter(m => m.isActive === false);

  res.status(200).json({
    count: result.length,
    count_active: active.length,
    count_inactive: inactive.length,
    grouped: {
      active,
      inactive
    }
  });
}));



router.post(
  "/upload-teamleiter",
  auth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
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
      if (!row[1]) {
        // Check if `Nachname` exists
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
  })
);

router.post(
  "/assignTask",
  auth,
  asyncHandler(async (req, res) => {
    const response = await assignFlipTask(req); // Pass the entire request object
    res.status(200).json({
      success: true,
      data: response,
    });
  })
);

router.post(
  "/create",
  auth,
  asyncHandler(async (req, res) => {
    const {
      asana_id,
      first_name,
      last_name,
      email,
      role = "USER",
      primary_user_group_id,
      profile,
      user_group_ids,
    } = req.body;

    const normalizedEmail = email.toLowerCase();
    let mitarbeiter;

    try {
      if (asana_id) {
        // Wenn Asana-ID vorhanden ist
        mitarbeiter = await Mitarbeiter.findOne({
          $or: [{ email: normalizedEmail }, { asana_id }],
        });
      } else {
        // Wenn KEINE Asana-ID vorhanden ist, schicke E-Mail an IT
        await sendMail(
          "it@straightforward.email",
          "⚠️ Mitarbeiter-Erstellung ohne Asana-ID",
          `
          <h2>⚠️ Mitarbeiter wird ohne Asana-ID erstellt!</h2>
          <p>Folgende Daten wurden übermittelt:</p>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>
          `
        );

        mitarbeiter = await Mitarbeiter.findOne({ email: normalizedEmail });
      }

      if (mitarbeiter) {
        if (!mitarbeiter.isActive) {
          mitarbeiter.isActive = true;
          await mitarbeiter.save();
        } else {
          return res.status(409).json({
            message:
              "Eine Person mit identischer Email/Asana-ID scheint bereits einen aktiven Flip-Account zu haben.",
          });
        }

        if (mitarbeiter.flip_id) {
          const flipUserFound = await findFlipUserById(mitarbeiter.flip_id);
          if (flipUserFound?.data) {
            if (flipUserFound.data.status === "ACTIVE") {
              return res.status(409).json({
                message:
                  "Eine Person mit identischer Email/Asana-ID scheint bereits einen aktiven Flip-Account zu haben.",
              });
            } else {
              return res.status(409).json({
                message:
                  "Diese Person ist entweder gesperrt oder für die Löschung markiert. Bitte in Flip Admin Konsole überprüfen.",
              });
            }
          } else {
            mitarbeiter.flip_id = null;
            await mitarbeiter.save();
          }
        }
      } else {
        // Erstelle neuen Mitarbeiter
        mitarbeiter = new Mitarbeiter({
          asana_id: asana_id || undefined, // undefined falls null
          vorname: first_name,
          nachname: last_name,
          email: normalizedEmail,
          isActive: true,
        });
        await mitarbeiter.save();
      }

      const flipUser = new FlipUser({
        external_id: mitarbeiter._id.toString(),
        first_name,
        last_name,
        email: normalizedEmail,
        status: "ACTIVE",
        benutzername: normalizedEmail,
        rolle: role,
        profile,
        primary_user_group_id,
      });

      let createdFlipUser;

      try {
        createdFlipUser = await flipUser.create();
        await createdFlipUser.setDefaultPassword();
      } catch (flipError) {
        mitarbeiter.isActive = false;
        await mitarbeiter.save();

        const errorDetails =
          flipError.message || flipError.response?.data || "Unbekannter Fehler";

        console.error("❌ Fehler beim Erstellen des FlipUsers:", errorDetails);

        await sendMail(
          "it@straightforward.email",
          "❌ Fehler beim Erstellen des FlipUsers",
          `
          <h2>❌ Fehler beim Erstellen des FlipUsers</h2>
          <p><strong>Error Details:</strong></p>
          <pre>${JSON.stringify(errorDetails, null, 2)}</pre>
          <p><strong>Mitarbeiter-ID:</strong> ${mitarbeiter._id}</p>
          <p><strong>Anfrage Daten:</strong></p>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>
          `
        );

        return res.status(500).json({
          message: "Fehler beim Erstellen des FlipUsers",
          error: errorDetails,
        });
      }

      mitarbeiter.flip_id = createdFlipUser.id;
      await mitarbeiter.save();

      if (user_group_ids?.length) {
        await assignFlipUserGroups({
          body: {
            items: user_group_ids.map((groupId) => ({
              user_id: createdFlipUser.id,
              user_group_id: groupId,
            })),
          },
        });
      }

      await assignFlipTask({
        body: {
          title: `Aufgabe erhalten: Flip Profil einrichten 😎`,
          recipients: [{ id: createdFlipUser.id, type: "USER" }],
          description: `<p>Gehe auf „<strong>Menü</strong>“ und tippe oben links auf den Kreis. Wenn du in den Einstellungen angekommen bist, tippst du auf deinen Namen und dann oben rechts auf „<strong>Bearbeiten</strong>“</p>
          <p>📋 Wähle ein Profilbild aus, auf dem man dich erkennt (und mit dem du dich wohlfühlst)</p>
          <p>📋 Im Absatz 'Über Mich' kannst du Leuten mitteilen, wer du bist</p>
          <p>📋 Du kannst auch deine Telefonnummer hinzufügen. Wenn du diese nicht öffentlich teilen möchtest, ist das vollkommen okay</p>`,
        },
      });

      res.status(201).json({
        message: "Flip user created/reactivated successfully",
        flipUser: createdFlipUser,
      });
    } catch (error) {
      console.error("❌ Error in createUserRequest:", error.message);

      await sendMail(
        "it@straightforward.email",
        "❌ Error Creating/Reactivating Flip User",
        `
        <h2>❌ Error during User Creation/Reactivation</h2>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Request Data:</strong></p>
        <pre>${JSON.stringify(req.body, null, 2)}</pre>
        `
      );

      res.status(500).json({
        message: "Error creating/reactivating Flip user",
        error: error.message,
      });
    }
  })
);



router.get(
  "/user-groups",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getFlipUserGroups(req.query);
    res.status(200).json(data);
  })
);

router.post(
  "/user-groups-assign",
  auth,
  asyncHandler(async (req, res) => {
    const data = await assignFlipUserGroups(req);
    res.status(200).json(data);
  })
);

router.get("/flip/by-id/:id", auth, asyncHandler(async (req, res) => {
  try{
    let id = req.params.id;
    let flipUserFound = await findFlipUserById(id);
    res.json(flipUserFound);
  } catch(err) {
    res.status(500).json({message: err.message});
  }
}))
router.get(
  "/duplicates/flip-id",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const duplicates = await Mitarbeiter.aggregate([
        {
          $group: {
            _id: "$flip_id",
            count: { $sum: 1 },
            docs: { $push: "$$ROOT" },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
        {
          $project: { _id: 0, flip_id: "$_id", mitarbeiter: "$docs" },
        },
      ]);

      res.json(duplicates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  })
);

router.get(
  "/duplicates/asana-id",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const duplicates = await Mitarbeiter.aggregate([
        {
          $match: { asana_id: { $ne: null } }, // Exclude documents where asana_id is null
        },
        {
          $group: {
            _id: "$asana_id",
            count: { $sum: 1 },
            docs: { $push: "$$ROOT" },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
        {
          $project: { _id: 0, asana_id: "$_id", mitarbeiter: "$docs" },
        },
      ]);

      res.json(duplicates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  })
);

router.get(
  "/duplicates/email",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const duplicates = await Mitarbeiter.aggregate([
        {
          $match: { email: { $ne: null } }, // Exclude documents where email is null
        },
        {
          $group: {
            _id: "$email",
            count: { $sum: 1 },
            docs: { $push: "$$ROOT" },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
        {
          $project: { _id: 0, email: "$_id", mitarbeiter: "$docs" },
        },
      ]);

      res.json(duplicates);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  })
);

router.get("/differences/username/email", auth, asyncHandler(async (req, res) => {
  try {
    const allUsers = await getFlipUsers(); // Holt alle Flip-User über Flip API

    // Filtere alle User, bei denen der Benutzername nicht der E-Mail entspricht
    const differingUsers = allUsers.filter(user => user.username !== user.email);

    res.status(200).json({
      success: true,
      count: differingUsers.length,
      users: differingUsers
    });
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der FlipUser-Differenzen:", err.message);
    res.status(500).json({ message: err.message });
  }
}));


router.delete(
  "/mitarbeiter/:id",
  auth,
  asyncHandler(async (req, res) => {
      const mitarbeiterId = req.params.id;

      // Suche und lösche den Mitarbeiter nach der ID
      const deletedMitarbeiter = await Mitarbeiter.findByIdAndDelete(
        mitarbeiterId
      );

      if (!deletedMitarbeiter) {
        return res.status(404).json({ message: "Mitarbeiter nicht gefunden" });
      }

      res.json({
        message: "Mitarbeiter erfolgreich gelöscht",
        mitarbeiter: deletedMitarbeiter,
      });
  })
);

module.exports = router;
