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
  findFlipUserByName,
  flipUserRoutine,
  asanaTransferRoutine,
  deleteManyFlipUsers,
  getFlipTaskAssignments,
  markAssignmentAsCompleted,
  getFlipAssignments,
  getFlipProfilePicture,
} = require("../FlipService");
const {
  findTasks,
  findAllTasks,
  updateTaskHtmlNotes,
  addLinkToTask,
  bewerberRoutine,
  getTaskById,
  getStoryById,
  getStoriesByTask,
  createStoryOnTask,
  getSubtaskByTask,
  createSubtasksOnTask,
  completeTaskById,
} = require("../AsanaService");
const asyncHandler = require("../middleware/AsyncHandler");
const JSZip = require("jszip");
const { PDFDocument } = require("pdf-lib");

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

const MONATSNAMEN = {
  "01": "Januar",
  "02": "Februar",
  "03": "März",
  "04": "April",
  "05": "Mai",
  "06": "Juni",
  "07": "Juli",
  "08": "August",
  "09": "September",
  10: "Oktober",
  11: "November",
  12: "Dezember",
};
const STADT_TEMPLATE_VARS = {
  Hamburg: {
    Sender_Name: "Alexandra Gridneva",
    Strasse: "Gaußstraße",
    Hausnummer: "124",
    PLZ: "22765",
    Stadt: "Hamburg",
    Telefon: "+49 40 700 101 90",
    Email: "teamhamburg@straightforward.email",
  },
  Berlin: {
    Sender_Name: "Svenja Dischinger",
    Strasse: "Straßmannstraße",
    Hausnummer: "6",
    PLZ: "10249",
    Stadt: "Berlin",
    Telefon: "+49 30 702 393 33",
    Email: "teamberlin@straightforward.email",
  },
  Köln: {
    Sender_Name: "Dominik Malter",
    Strasse: "Zülpicher Str.",
    Hausnummer: "85",
    PLZ: "50937",
    Stadt: "Köln",
    Telefon: "+49 221 777 100 22",
    Email: "teamkoeln@straightforward.email",
  },
};

function normalizeUmlauts(str) {
  return str
    .normalize("NFD") // Unicode z.B. "ö" → "o¨"
    .replace(/[\u0300-\u036f]/g, "") // diakritische Zeichen entfernen
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]/g, ""); // Restliche Sonderzeichen entfernen
}

function normalizeUmlautsForSort(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Diakritika entfernen
    .replace(/[^a-z]/g, ""); // Nur Buchstaben behalten
}

router.get(
  "/flip",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getFlipUsers(req.query);
    res.status(200).json(data);
  })
);

router.get(
  "/flip/profilePicture/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { data, contentType } = await getFlipProfilePicture(id);

    res.set("Content-Type", contentType);
    res.send(Buffer.from(data, "binary"));
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
    const {
      sortField = "dateCreated",
      sortOrder = "desc",
      ...rawFilters
    } = req.query;

    const filters = {};

    // Dynamische Filter-Konvertierung
    for (const [key, value] of Object.entries(rawFilters)) {
      if (value === "null") {
        filters[key] = null;
      } else if (value === "true") {
        filters[key] = true;
      } else if (value === "false") {
        filters[key] = false;
      } else {
        filters[key] = value;
      }
    }

    const sortOptions = {};
    if (sortField) {
      sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;
    }

    const mitarbeiter = await Mitarbeiter.find(filters)
      .sort(sortOptions)
      .populate([
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

router.patch(
  "/mitarbeiter/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Sicherheitsmaßnahme: Verhindern, dass kritische oder automatisch
    // verwaltete Felder direkt über diesen Endpunkt geändert werden.
    delete updateData._id;
    delete updateData.dateCreated;
    delete updateData.laufzettel_received;
    delete updateData.laufzettel_submitted;
    delete updateData.eventreports;
    delete updateData.evaluierungen_received;
    delete updateData.evaluierungen_submitted;

    // Email immer in Kleinbuchstaben speichern, falls sie aktualisiert wird
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    try {
      // Finde den Mitarbeiter und aktualisiere ihn in einem atomaren Vorgang.
      // Die Option { new: true } sorgt dafür, dass das aktualisierte Dokument zurückgegeben wird.
      // { runValidators: true } stellt sicher, dass Schema-Regeln (z.B. 'unique' für E-Mail) geprüft werden.
      const mitarbeiter = await Mitarbeiter.findByIdAndUpdate(
        id,
        { $set: updateData }, // $set stellt sicher, dass nur die übergebenen Felder aktualisiert werden
        {
          new: true,
          runValidators: true,
          context: "query", // Wichtig für 'unique' Validatoren bei Updates
        }
      ).populate([
        { path: "laufzettel_received", select: "_id name" },
        { path: "laufzettel_submitted", select: "_id name" },
        { path: "eventreports", select: "_id title" },
        { path: "evaluierungen_received", select: "_id score" },
        { path: "evaluierungen_submitted", select: "_id score" },
      ]);

      // Fall: Mitarbeiter mit der gegebenen ID wurde nicht gefunden.
      if (!mitarbeiter) {
        return res.status(404).json({
          success: false,
          message: "Mitarbeiter mit dieser ID nicht gefunden.",
        });
      }

      // Erfolgreiche Antwort mit dem aktualisierten Mitarbeiter
      res.status(200).json({
        success: true,
        data: mitarbeiter,
      });
    } catch (error) {
      // Spezifisches Error-Handling für Duplikate (z.B. E-Mail oder asana_id)
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(409).json({
          // 409 Conflict
          success: false,
          message: `Ein Mitarbeiter mit diesem Wert für '${field}' existiert bereits.`,
        });
      }

      // Generisches Error-Handling für andere Validierungsfehler
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: `Validierungsfehler: ${error.message}`,
        });
      }

      // Alle anderen Fehler werden vom asyncHandler an die globale Fehlerbehandlung weitergeleitet
      throw error;
    }
  })
);

module.exports = router;

router.get(
  "/initialRoutine",
  auth,
  asyncHandler(async (req, res) => {
    const data = await flipUserRoutine();
    res.status(200).json(data);
  })
);

router.get(
  "/asanaRoutine",
  auth,
  asyncHandler(async (req, res) => {
    const sections = [
      { id: "1207021175334609", name: "Hamburg" },
      { id: "1205091014657240", name: "Berlin" },
      { id: "1208816204908538", name: "Köln" },
    ];
    for (const section of sections) {
      await asanaTransferRoutine(section.id, section.name);
    }
    res.status(200).json();
  })
);

router.get(
  "/missingAsanaRefs",
  auth,
  asyncHandler(async (req, res) => {
    const result = await Mitarbeiter.find({
      $or: [
        { asana_id: null },
        { asana_id: "" },
        { asana_id: { $exists: false } },
      ],
    });

    const active = result.filter((m) => m.isActive === true);
    const inactive = result.filter((m) => m.isActive === false);

    res.status(200).json({
      count: result.length,
      count_active: active.length,
      count_inactive: inactive.length,
      grouped: {
        active,
        inactive,
      },
    });
  })
);

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
  "/upload-lohnabrechnungen",
  auth,
  multer({ storage }).fields([
    { name: "pdf", maxCount: 1 },
    { name: "excel", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    try {
      // Schritt 1: Formulardaten inkl. stadt_full auslesen
      const { stadt, monat, stadt_full } = req.body;
      const pdfBuffer = req.files?.pdf?.[0]?.buffer;
      const excelBuffer = req.files?.excel?.[0]?.buffer;

      // Validierung der Eingabedaten
      if (!pdfBuffer || !excelBuffer || !stadt || !monat || !stadt_full) {
        console.warn("❗ Fehlende Daten:", {
          pdf: !!pdfBuffer,
          excel: !!excelBuffer,
          stadt,
          monat,
          stadt_full,
        });
        return res.status(400).json({
          error:
            "Fehlende Daten. Stellen Sie sicher, dass PDF, Excel, Stadt, Monat und Stadt (ausgeschrieben) gesendet werden.",
        });
      }

      console.log("✅ PDF + Excel + Formulardaten empfangen");
      const originalPdf = await PDFDocument.load(pdfBuffer);
      const pageCount = originalPdf.getPageCount();
      console.log(`📄 PDF hat ${pageCount} Seiten`);

      const workbook = xlsx.read(excelBuffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const data = rows
  .slice(1)
  .filter((row) =>
    row.some((cell) => cell !== null && String(cell).trim() !== "")
  )
  .sort((a, b) =>
    normalizeUmlautsForSort(a[1])?.localeCompare(normalizeUmlautsForSort(b[1]))
  );

      console.log(`📊 Excel-Zeilen (ohne Header): ${data.length}`);
      if (pageCount < data.length) {
        return res.status(400).json({
          error:
            "Weniger PDF-Seiten als Excel-Zeilen. Möglicherweise Doppelseiten in PDF?",
        });
      }

      const zip = new JSZip();
      const jahr = new Date().getFullYear(); // Aktuelles Jahr für die Vorlage
      const monatLesbar = MONATSNAMEN[monat.padStart(2, "0")] || monat;

      if (pageCount !== data.length) {
        return res.status(400).json({
          error: `Die Anzahl der PDF-Seiten (${pageCount}) stimmt nicht exakt mit der Anzahl der Excel-Zeilen (${data.length}) überein.`,
        });
      }

      const stadtVars = STADT_TEMPLATE_VARS[stadt_full];
      if (!stadtVars) {
        return res.status(400).json({
          error: `Unbekannter Standort "${stadt_full}". Keine Absenderdaten gefunden.`,
        });
      }

      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        const rawNachname = (row[1] || "Unbekannt").trim();
        const rawVorname = (row[2] || "Mitarbeiter").trim();

        const vorname = rawVorname;
        const nachname = rawNachname;

        const safeVorname = rawVorname
          .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
          .replace(/\s+/g, "_");
        const safeNachname = rawNachname
          .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
          .replace(/\s+/g, "_");

        const email = row[8] || null;

        const outputPdf = await PDFDocument.create();
        const [page] = await outputPdf.copyPages(originalPdf, [i]);
        outputPdf.addPage(page);

        const fileBuffer = await outputPdf.save();
        const filename = `${safeNachname}_${safeVorname}_Abrechnungen_${stadt}_${monat}.pdf`;
        zip.file(filename, fileBuffer);

        const subject = `Lohnabrechnung Straightforward ${monatLesbar} ${jahr}`;
        const content = `
    <div style="font-family: Arial, sans-serif; font-size: 11pt; color: #333;">
      <p>Hallo ${vorname},</p>
      <p>anbei deine Lohnabrechnung für ${monatLesbar} ${jahr}.</p>
      <p>Melde dich bei Fragen gerne bei uns.</p>
      <p>Beste Grüße</p>
      <br>
      <div style="line-height: 1.4;">
          <p style="margin: 0;"><strong>${stadtVars.Sender_Name}</strong></p>
          <p style="margin: 0;"><em>Team ${stadt_full}</em></p>
          <br>
          <p style="margin: 0;">${stadtVars.Strasse} ${stadtVars.Hausnummer}</p>
          <p style="margin: 0;">${stadtVars.PLZ} ${stadtVars.Stadt}</p>
          <br>
          <p style="margin: 0;">Tel: <a href="tel:${stadtVars.Telefon}">${stadtVars.Telefon}</a></p>
          <br>
          <p style="margin: 0;"><a href="mailto:${stadtVars.Email}">${stadtVars.Email}</a></p>
          <p style="margin: 0;"><a href="https://www.straightforward.services" target="_blank">www.straightforward.services</a></p>
      </div>
      <br>
      <div style="font-size: 8pt; color: #666; line-height: 1.3;">
          <p style="margin: 0;"><strong>H. & P. Straightforward GmbH</strong></p>
          <p style="margin: 0;">Managing Partners: Daniel Hansen & Christian Peßler</p>
          <p style="margin: 0;">Based in: Berlin HRB 180342 B</p>
          <p style="margin: 0;">VAT no.: DE308384616</p>
          <br>
          <p style="margin: 0;"><em>Please consider the impact on the environment before printing this e-mail. This communication is confidential and may be legally privileged. If you are not the intended recipient, (i) please do not read or disclose to others, (ii) please notify the sender by reply mail, and (iii) please delete this communication from your system. Failure to follow this process may be unlawful. Thank you for your cooperation.</em></p>
      </div>
    </div>
  `;

        const stadtSenderMap = {
          HH: "teamhamburg",
          B: "teamberlin",
          K: "teamkoeln",
        };

        const senderKey = stadtSenderMap[stadt] || "it";

        try {
          await sendMail(
            // email ||
            "it@straightforward.email",
            subject,
            content,
            senderKey,
            [
              {
                name: filename,
                content: Buffer.from(fileBuffer).toString("base64"),
                contentType: "application/pdf",
              },
            ]
          );
          console.log(
            `📤 Abrechnung für ${vorname} ${nachname} an ${email} verschickt.`
          );
        } catch (mailError) {
          console.error(
            `❌ Fehler beim Senden an ${email}:`,
            mailError.message
          );
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      console.log(`✅ ZIP-Größe: ${zipBuffer.length} Bytes`);
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=Abrechnungen_${stadt}_${monat}.zip`,
      });
      res.send(zipBuffer);
    } catch (err) {
      console.error("❌ Fehler beim Aufteilen der Lohnabrechnungen:", err);
      res.status(500).json({ error: "Interner Serverfehler" });
    }
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
router.get(
  "/task/assignments/:id",
  auth,
  asyncHandler(async (req, res) => {
    let id = req.params.id;
    const response = await getFlipTaskAssignments(id);
    res.status(200).json({
      success: true,
      data: response,
    });
  })
);
router.get(
  "/task/assignments",
  auth,
  asyncHandler(async (req, res) => {
    const response = await getFlipAssignments();
    res.status(200).json({
      success: true,
      data: response,
    });
  })
);

router.post(
  "/task/assignments/:id/complete",
  auth,
  asyncHandler(async (req, res) => {
    let id = req.params.id;
    const response = await markAssignmentAsCompleted(id);
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
      created_by,
      primary_user_group_id,
      attributes,
      user_group_ids,
    } = req.body;

    const normalizedEmail = email.toLowerCase();
    let mitarbeiter;
    console.log(req.body);
    try {
      // Erst Mitarbeiter finden, wenn asana_id vorhanden
      if (asana_id) {
        mitarbeiter = await Mitarbeiter.findOne({
          $or: [{ email: normalizedEmail }, { asana_id }],
        });
      } else {
        // Benachrichtigung an IT, wenn keine Asana-ID
        await sendMail(
          "it@straightforward.email",
          "⚠️ Mitarbeiter-Erstellung ohne Asana-ID",
          `<h2>⚠️ Mitarbeiter wird ohne Asana-ID erstellt!</h2>
          <p>Folgende Daten wurden übermittelt:</p>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>`
        );
        mitarbeiter = await Mitarbeiter.findOne({ email: normalizedEmail });
      }

      // Wenn Mitarbeiter gefunden
      if (mitarbeiter) {
        // Flip User Status prüfen, falls flip_id existiert
        if (mitarbeiter.flip_id) {
          try {
            let flipUserFound = await findFlipUserById(mitarbeiter.flip_id);
            if (flipUserFound?.data?.status === "ACTIVE") {
              return res.status(409).json({
                message:
                  "Aktiver Flip-User mit identischer Email/Asana-ID existiert bereits.",
              });
            } else if (flipUserFound?.data?.status === "PENDING_DELETION") {
              return res.status(409).json({
                message:
                  "Flip-User befindet sich im Status 'PENDING_DELETION'. Bitte prüfen.",
              });
            } else {
              return res.status(409).json({
                message:
                  "Flip-User befindet sich im Status 'LOCKED'. Bitte prüfen.",
              });
            }
          } catch (error) {
            if (
              error.response?.status === 403 &&
              error.response?.data?.error_code === "PERMISSION_MISSING"
            ) {
              // 🧹 Clean up outdated flip_id
              mitarbeiter.flip_id = null;
              await mitarbeiter.save();
              console.warn(
                `⚠️ Outdated flip_id removed from Mitarbeiter: ${mitarbeiter.email}`
              );
            } else {
              throw error; // Let other errors bubble up
            }
          }
        }
        mitarbeiter.asana_id = asana_id;
        mitarbeiter.vorname = first_name;
        mitarbeiter.nachname = last_name;
        mitarbeiter.email = normalizedEmail;
        mitarbeiter.erstellt_von = created_by;
        mitarbeiter.isActive = true;
        await mitarbeiter.save();
      } else {
        // Mitarbeiter neu erstellen
        mitarbeiter = new Mitarbeiter({
          asana_id: asana_id || undefined,
          vorname: first_name,
          nachname: last_name,
          email: normalizedEmail,
          erstellt_von: created_by,
          isActive: true,
        });
        await mitarbeiter.save();
      }

      // FlipUser anlegen
      const flipUser = new FlipUser({
        first_name,
        last_name,
        email: normalizedEmail,
        status: "ACTIVE",
        benutzername: normalizedEmail,
        rolle: role,
        attributes,
        primary_user_group_id,
      });

      let createdFlipUser;

      try {
        createdFlipUser = await flipUser.create();
        await createdFlipUser.setDefaultPassword();

        if (asana_id) {
          await createStoryOnTask(asana_id, {
            html_text: `<body>Mitarbeiter wurde automatisch erstellt.</body>`,
          });
        }
      } catch (flipError) {
        await sendMail(
          "it@straightforward.email",
          "❌ Fehler beim Erstellen des FlipUsers",
          `<h2>❌ Fehler beim Erstellen des FlipUsers</h2>
          <pre>${JSON.stringify(
            flipError.message || flipError.response?.data,
            null,
            2
          )}</pre>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>`
        );

        return res.status(500).json({
          message: "Fehler beim Erstellen des FlipUsers",
          error: flipError.message || flipError.response?.data,
        });
      }

      mitarbeiter.flip_id = createdFlipUser.id;
      await mitarbeiter.save();

      // Usergruppen zuweisen falls vorhanden
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

      // Aufgabe erstellen mit Frist in drei Tagen um 18 Uhr
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      dueDate.setHours(18, 0, 0, 0);

      await assignFlipTask({
        body: {
          title: "Aufgabe erhalten: Flip Profil einrichten 😎",
          recipients: [{ id: createdFlipUser.id, type: "USER" }],
          due_at: {
            date_time: dueDate.toISOString(),
            due_at_type: "DATE_TIME",
          },
          description: `
          <p>Gehe auf „<strong>Menü</strong>“ und tippe oben links auf den Kreis. Tippe dann auf deinen Namen und „<strong>Bearbeiten</strong>“</p>
          <ul>
            <li>📋 Profilbild wählen</li>
            <li>📋 Absatz 'Über Mich' ausfüllen</li>
            <li>📋 Telefonnummer hinzufügen (optional)</li>
          </ul>`,
        },
      });

      res.status(201).json({
        message: "Flip user created/reactivated successfully",
        flipUser: createdFlipUser,
      });
    } catch (error) {
      console.error("❌ Error in createUserRequest:", error);

      await sendMail(
        "it@straightforward.email",
        "❌ Fehler bei Mitarbeiter-Erstellung/Reaktivierung",
        `<h2>❌ Fehler bei Mitarbeiter-Erstellung/Reaktivierung</h2>
        <pre>${error.message}</pre>
        <pre>${JSON.stringify(req.body, null, 2)}</pre>`
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

router.get(
  "/flip/by-id/:id",
  auth,
  asyncHandler(async (req, res) => {
    try {
      let id = req.params.id;
      let flipUserFound = await findFlipUserById(id);
      res.status(200).json(flipUserFound);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  })
);
router.patch(
  "/flip/user/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const response = await flipAxios.patch(
      `/api/admin/users/v4/users/${id}`,
      updateData,
      { headers: { "content-type": "application/merge-patch+json" } }
    );

    res.status(200).json({ success: true, data: response.data });
  })
);
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

router.get(
  "/differences/username/email",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const allUsers = await getFlipUsers(); // Holt alle Flip-User über Flip API

      // Filtere alle User, bei denen der Benutzername nicht der E-Mail entspricht
      const differingUsers = allUsers.filter(
        (user) => user.username !== user.email
      );

      res.status(200).json({
        success: true,
        count: differingUsers.length,
        users: differingUsers,
      });
    } catch (err) {
      console.error(
        "❌ Fehler beim Abrufen der FlipUser-Differenzen:",
        err.message
      );
      res.status(500).json({ message: err.message });
    }
  })
);

router.get(
  "/unfinishedAsanaTasks",
  auth,
  asyncHandler(async (req, res) => {
    const project_ids = [
      "1207021175334601",
      "1203882830937566",
      "1208815878474860",
    ];

    const result = [];

    for (const id of project_ids) {
      const opts = {
        project: id,
        completed_since: new Date().toISOString(),
        opt_fields: "gid, name, html_notes, completed",
      };

      const tasks = await findTasks(opts);

      if (!tasks || tasks.length === 0) {
        continue; // move on to next project
      }

      for (const task of tasks) {
        if (task.completed) continue; // skip already completed

        // find Mitarbeiter with asana_id = task.gid
        const mitarbeiter = await Mitarbeiter.findOne({ asana_id: task.gid });

        if (mitarbeiter && !mitarbeiter.isActive) {
          try {
            const response = await completeTaskById(task.gid);
            const responseTask = response?.data || response;
            result.push(`✅ Task "${responseTask.name}" completed`);
          } catch (err) {
            result.push(
              `❌ Failed to complete task ${task.gid}: ${err.message}`
            );
          }
        }
      }
    }

    if (result.length === 0) {
      return res
        .status(200)
        .json({ message: "No matching unfinished tasks found." });
    }

    res.status(200).json({ result });
  })
);

// Delete route
router.post(
  "/flip/exit",
  asyncHandler(async (req, res) => {
    let userList = req.body;
    userList = userList.filter((user) => user && user.vorname && user.nachname);
    console.log(userList);
    const foundIds = [];
    const notFound = [];

    for (const { vorname, nachname } of userList) {
      const fullName = `${vorname} ${nachname}`;
      const flipUserId = await findFlipUserByName(fullName);

      if (flipUserId) {
        foundIds.push(flipUserId);
      } else {
        notFound.push(fullName);
      }
    }

    if (foundIds.length > 0) {
      try {
        await deleteManyFlipUsers(foundIds);
      } catch (error) {
        console.error("❌ Fehler beim Löschen:", error);
        return res.status(500).json({ error: error.message, notFound });
      }
    }

    res.status(200).json({ deleted: foundIds.length, notFound });
  })
);

router.delete(
  "/mitarbeiter",
  auth,
  asyncHandler(async (req, res) => {
    const mitarbeiterIds = req.body;
    const flipIdsToDelete = [];
    const deletedMitarbeiter = [];
    const notFound = [];

    if (!Array.isArray(mitarbeiterIds) || mitarbeiterIds.length === 0) {
      return res.status(400).json({ message: "Keine IDs übergeben." });
    }

    // 1. Flip-IDs sammeln
    for (const mitarbeiterId of mitarbeiterIds) {
      const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
      if (!mitarbeiter) {
        notFound.push(mitarbeiterId);
        continue;
      }

      if (mitarbeiter.flip_id) {
        flipIdsToDelete.push(mitarbeiter.flip_id);
      }
    }

    // 2. Flip-Nutzer löschen
    try {
      if (flipIdsToDelete.length > 0) {
        await deleteManyFlipUsers(flipIdsToDelete);
      }
    } catch (error) {
      console.error("❌ Fehler beim Löschen der Flip-Nutzer:", error);
      return res.status(500).json({
        message: "Fehler beim Löschen der Flip-Nutzer",
        error: error.message,
      });
    }

    // 3. Mitarbeiter löschen
    for (const mitarbeiterId of mitarbeiterIds) {
      try {
        const deleted = await Mitarbeiter.findByIdAndDelete(mitarbeiterId);
        if (deleted) deletedMitarbeiter.push(deleted);
        else notFound.push(mitarbeiterId);
      } catch (error) {
        console.error("❌ Fehler beim Löschen eines Mitarbeiters:", error);
        notFound.push(mitarbeiterId);
      }
    }

    // 4. Rückmeldung
    res.status(200).json({
      message: "Löschvorgang abgeschlossen",
      deleted: deletedMitarbeiter.map((m) => ({
        id: m._id,
        name: `${m.vorname} ${m.nachname}`,
      })),
      notFound,
    });
  })
);

module.exports = router;
