const express = require("express");
const router = express.Router();
const SSE = require("express-sse");
const sse = new SSE();
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load environment variables from .env
const stringSimilarity = require("string-similarity");
const auth = require("../middleware/auth");
const xlsx = require("xlsx");
const multer = require("multer");
const path = require("path");
const Mitarbeiter = require("../models/Mitarbeiter");
const FlipUser = require("../models/Classes/FlipUser");
const { sendMail } = require("../EmailService");
const storage = multer.memoryStorage();
const { flipAxios } = require("../flipAxios");
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
const progressMap = new Map();

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, ""); 
}

async function sendAllMailsInBackground(
  data,
  userId,
  originalPdf,
  stadtVars,
  monatLesbar,
  jahr,
  stadt_full,
  stadt,
  dokumentart
) {
  const senderMap = { HH: "teamhamburg", B: "teamberlin", K: "teamkoeln" };
  const senderKey = senderMap[stadt] || "it";

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rawNachname = (row[1] || "Unbekannt").trim();
    const rawVorname = (row[2] || "Mitarbeiter").trim();
    const email = row[4] || null;

    const safeVorname = rawVorname
  .normalize("NFD") 
  .replace(/[\u0300-\u036f]/g, "") 
  .replace(/[^a-zA-ZäöüÄÖÜß]/g, "") 
  .replace(/\s+/g, "_"); 

const safeNachname = rawNachname
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
  .replace(/\s+/g, "_");
    const filename = `${safeNachname}_${safeVorname}_${dokumentart}_${stadt}.pdf`;

    const outputPdf = await PDFDocument.create();
    const [page] = await outputPdf.copyPages(originalPdf, [i]);
    outputPdf.addPage(page);
    const fileBuffer = await outputPdf.save();

    const content = getEmailTemplate(dokumentart, {
      vorname: rawVorname,
      monatLesbar,
      jahr,
      stadt_full,
      stadtVars,
    });

    try {
      await sendMail(
         email || 
         "it@straightforward.email",
        `${dokumentart} ${monatLesbar} ${jahr}`,
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

      const stream = progressMap.get(userId);
      if (stream)
        stream.write(
          `data: ${i + 1}/${data.length} ${rawVorname} ${rawNachname}\n\n`
        );
    } catch (err) {
      console.error("❌ Fehler bei Mail an", email, err.message);
    }
  }

  const stream = progressMap.get(userId);
  if (stream) {
    stream.write("event: done\ndata: Alle E-Mails verschickt\n\n");
    stream.end();
    progressMap.delete(userId);
  }
}

router.get(
  "/flip",
  auth,
  asyncHandler(async (req, res) => {
    const data = await getFlipUsers(req.query);
    res.status(200).json(data);
  })
);

// Profile Picture Route mit verbessertem Error-Handling
router.get(
  "/flip/profilePicture/:id",
  auth, // Auth-Middleware
  asyncHandler(async (req, res) => {
    const userId = req.params.id;
    console.log(`🖼️ Profile picture request for user: ${userId}`);
    
    try {
      const result = await getFlipProfilePicture(userId);

      if (!result || !result.data) {
        // kein Avatar hinterlegt
        console.log(`❌ No profile picture found for user: ${userId}`);
        return res.status(204).end();
      }
      
      console.log(`✅ Profile picture found for user ${userId}: ${result.data?.length || 0} bytes, type: ${result.contentType}`);
      
      // Cache-Headers setzen für bessere Performance
      res.set({
        "Content-Type": result.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=3600", // 1 Stunde Cache
        "ETag": `"${userId}"` // Simple ETag basierend auf User-ID
      });
      
      // Direkt Buffer senden, falls result.data bereits ein Buffer/ArrayBuffer ist
      if (Buffer.isBuffer(result.data)) {
        res.send(result.data);
      } else if (result.data instanceof ArrayBuffer) {
        res.send(Buffer.from(result.data));
      } else {
        res.send(Buffer.from(result.data, "binary"));
      }
    } catch (error) {
      console.error(`❌ Error fetching profile picture for user ${userId}:`, error);
      res.status(500).json({ message: "Failed to fetch profile picture" });
    }
  })
);

// --- Flip Task endpoints (moved here so all personal-related routes live under /api/personal) ---
// Get tasks for a Flip user (by Flip user id)
router.get(
  "/flip/tasks/:userId",
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // Temporarily disable Flip API due to API issues - return placeholder data
    // TODO: Re-enable once Flip API distribution_kind parameter is fixed
    const FLIP_TASKS_ENABLED = process.env.FLIP_TASKS_ENABLED === 'true';
    
    if (!FLIP_TASKS_ENABLED) {
      console.log(`Flip tasks API disabled, returning placeholder data for user ${userId}`);
      
      // Return placeholder tasks for development/testing
      const placeholderTasks = [
        {
          id: "placeholder-task-1",
          title: "Beispiel-Aufgabe: Profil einrichten",
          body: {
            html: "<p>Bitte richte dein Flip-Profil ein und füge ein Profilbild hinzu.</p>",
            plain: "Bitte richte dein Flip-Profil ein und füge ein Profilbild hinzu.",
            language: "de"
          },
          progress_status: "OPEN",
          due_at: {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
            type: "DATE"
          },
          created_at: new Date().toISOString(),
          link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/placeholder-1`,
        },
        {
          id: "placeholder-task-2", 
          title: "Willkommen bei Straightforward",
          body: {
            html: "<p>Willkommen im Team! Diese Aufgabe wird automatisch erstellt, bis die Flip API wieder verfügbar ist.</p>",
            plain: "Willkommen im Team! Diese Aufgabe wird automatisch erstellt, bis die Flip API wieder verfügbar ist.",
            language: "de"
          },
          progress_status: "IN_PROGRESS",
          due_at: null,
          created_at: new Date().toISOString(),
          link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/placeholder-2`,
        }
      ];
      
      return res.json(placeholderTasks);
    }

    try {

      let assignmentsResponse;
      
      // Debug: Welcher API-Client und User wird verwendet?
      console.log("🔍 Debug Info:");
      console.log("   - Requested User ID:", userId);
      console.log("   - Flip API Base URL:", process.env.FLIP_SYNC_URL);
      console.log("   - Flip Client ID:", process.env.FLIP_SYNC_CLIENT_ID);
      
      // Debug: User-ID Matching Problem analysieren
      const testResponse = await flipAxios.get("/api/tasks/v4/tasks/assignments", {
        params: { distribution_kind: "RECEIVED,PERSONAL", body_format: "PLAIN" }
      });
      const allUserIds = [...new Set(testResponse.data.assignments?.map(a => a.user_id) || [])];
      
      console.log("🔍 User-ID Matching Analysis:");
      console.log("   - Requested User ID:", userId);
      console.log("   - Available User IDs in Flip:", allUserIds);
      console.log("   - Match found:", allUserIds.includes(userId));
      
      if (!allUserIds.includes(userId)) {
        console.log("❌ User-ID mismatch detected!");
        console.log("   - The requested user ID is not in any Flip assignments");
        console.log("   - Check if the flip_id in the database is correct");
        console.log("   - Available assignments:", testResponse.data.assignments?.map(a => ({
          user_id: a.user_id, 
          task_title: a.task?.title
        })));
      }
      
      // Test: Andere API-Endpoints ausprobieren
      try {
        console.log("🔄 Trying alternative API endpoints...");
        
        // Versuche alle Tasks zu bekommen (nicht user-spezifisch)
        console.log("📋 Trying /api/tasks/v4/tasks (all tasks)...");
        const allTasksResponse = await flipAxios.get("/api/tasks/v4/tasks", {
          params: { body_format: "PLAIN" }
        });
        console.log("� All Tasks Response:", JSON.stringify(allTasksResponse.data, null, 2));
        
      } catch (allTasksErr) {
        console.log("❌ All tasks API failed:", allTasksErr.response?.data || allTasksErr.message);
        
        // Fallback: Versuche User-spezifische Task-API
        try {
          console.log("🔄 Trying user-specific task endpoint...");
          const userTasksResponse = await flipAxios.get(`/api/tasks/v4/users/${userId}/tasks`);
          console.log("🔍 User Tasks Response:", JSON.stringify(userTasksResponse.data, null, 2));
        } catch (userTasksErr) {
          console.log("❌ User tasks API failed:", userTasksErr.response?.data || userTasksErr.message);
        }
      }

      // Erst mal OHNE progress_status Filter testen
      try {
        console.log("🔄 Trying API call WITHOUT progress_status filter first...");
        let testResponse = await flipAxios.get("/api/tasks/v4/tasks/assignments", {
          params: { 
            distribution_kind: "RECEIVED,PERSONAL",
            body_format: "PLAIN"
          },
        });
        
        console.log("🔍 Test Response (no status filter):", JSON.stringify(testResponse.data, null, 2));
        
        // Jetzt mit erweiterten Status-Filter (inkl. FINISHED)
        assignmentsResponse = await flipAxios.get("/api/tasks/v4/tasks/assignments", {
          params: { 
            distribution_kind: "RECEIVED,PERSONAL",
            progress_status: ["NEW", "IN_PROGRESS", "FINISHED", "DONE"],
            body_format: "PLAIN"
          },
        });
        
        console.log("🔍 Flip API Response Status (with filter):", assignmentsResponse.status);
        console.log("🔍 Flip API Response Data (with filter):", JSON.stringify(assignmentsResponse.data, null, 2));
        
      } catch (distributionError) {
        console.warn("Flip API error, falling back to placeholder:", distributionError.response?.data);
        return res.json([]);
      }

      if (!assignmentsResponse.data || !assignmentsResponse.data.assignments) {
        console.log("❌ No assignments data in response");
        return res.json([]);
      }

      console.log("📊 Total assignments received:", assignmentsResponse.data.assignments.length);

      // Analysiere Assignments um zwischen "assigned by me" und "assigned to me" zu unterscheiden
      console.log(`📋 Available assignments through API client: ${assignmentsResponse.data.assignments.length}`);
      
      // Kategorisiere Assignments
      const assignedToMe = assignmentsResponse.data.assignments.filter(assignment => 
        assignment.user_id === userId
      );
      
      const assignedByMe = assignmentsResponse.data.assignments.filter(assignment => 
        assignment.task?.author_id === userId
      );
      
      // Alle anderen (vom API-Client erstellte oder sichtbare Tasks)
      const availableTasks = assignmentsResponse.data.assignments.filter(assignment => 
        assignment.user_id !== userId && assignment.task?.author_id !== userId
      );
      
      console.log(`🔍 Assignments TO user ${userId}: ${assignedToMe.length}`);
      console.log(`🔍 Assignments BY user ${userId}: ${assignedByMe.length}`);
      console.log(`🔍 Other available tasks: ${availableTasks.length}`);
      
      // Sammle alle Task-IDs mit Kategorisierung
      const taskCategories = {
        assignedToMe: assignedToMe.map(a => ({ taskId: a.task?.id, assignment: a })).filter(t => t.taskId),
        assignedByMe: assignedByMe.map(a => ({ taskId: a.task?.id, assignment: a })).filter(t => t.taskId),
        available: availableTasks.map(a => ({ taskId: a.task?.id, assignment: a })).filter(t => t.taskId)
      };
      
      // Alle Task-IDs sammeln
      const allTaskIds = [
        ...taskCategories.assignedToMe.map(t => t.taskId),
        ...taskCategories.assignedByMe.map(t => t.taskId),
        ...taskCategories.available.map(t => t.taskId)
      ];
      
      const taskIds = [...new Set(allTaskIds)];
      console.log("🔍 Unique task IDs to fetch:", taskIds);

      if (taskIds.length === 0) {
        console.log("ℹ️ No tasks available in API client scope");
        return res.json([]);
      }

      // Fetch task details for each task ID
      console.log("🔄 Fetching task details for", taskIds.length, "tasks");
      const tasks = [];
      for (const taskId of taskIds) {
        try {
          console.log(`🔄 Fetching task details for ID: ${taskId}`);
          const taskResponse = await flipAxios.get(`/api/tasks/v4/tasks/${taskId}`, {
            params: { body_format: "HTML,PLAIN" }
          });
          
          console.log(`✅ Task ${taskId} response:`, JSON.stringify(taskResponse.data, null, 2));
          
          if (taskResponse.data) {
            const task = taskResponse.data;
            
            // Bestimme Kategorie des Tasks
            let category = 'available';
            if (taskCategories.assignedToMe.some(t => t.taskId === task.id)) {
              category = 'assignedToMe';
            } else if (taskCategories.assignedByMe.some(t => t.taskId === task.id)) {
              category = 'assignedByMe';
            }
            
            tasks.push({
              id: task.id,
              title: task.title,
              body: {
                html: task.body?.html || "",
                plain: task.body?.plain || "",
                language: task.body?.language || null
              },
              progress_status: task.progress_status || "OPEN",
              due_at: task.due_at ? {
                date: task.due_at.date,
                type: task.due_at.type || "DATE"
              } : null,
              created_at: task.created_at,
              link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/${task.id}`,
              category: category, // Neue Kategorisierung
              author_id: task.author_id || null
            });
          }
        } catch (taskErr) {
          console.warn(`❌ Could not fetch task ${taskId}:`, taskErr.response?.data || taskErr.message);
        }
      }

      console.log("🎯 Final tasks to return:", tasks.length);
      
      // Strukturiere Tasks nach Kategorien für Frontend
      const categorizedTasks = {
        assignedToMe: tasks.filter(t => t.category === 'assignedToMe'),
        assignedByMe: tasks.filter(t => t.category === 'assignedByMe'),
        available: tasks.filter(t => t.category === 'available'),
        total: tasks.length,
        summary: {
          assignedToMe: tasks.filter(t => t.category === 'assignedToMe').length,
          assignedByMe: tasks.filter(t => t.category === 'assignedByMe').length,
          available: tasks.filter(t => t.category === 'available').length
        }
      };
      
      console.log("🎯 Categorized tasks summary:", categorizedTasks.summary);
      
      // Gebe strukturierte Antwort zurück
      if (tasks.length > 0) {
        res.json(categorizedTasks);
      } else {
        // Falls gar keine Tasks da sind, gib leere Struktur zurück
        console.log("ℹ️ No tasks available from API client scope");
        res.json({
          assignedToMe: [],
          assignedByMe: [],
          available: [],
          total: 0,
          summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
        });
      }
    } catch (err) {
      console.error(`Error fetching tasks for user ${userId}:`, err.response?.data || err.message);
      // Return empty array instead of error to prevent frontend crashes
      res.json([]);
    }
  })
);

// Neue umfassende Route für alle Tasks eines Users
router.get(
  "/flip/tasks/comprehensive/:userId",
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const FLIP_TASKS_ENABLED = process.env.FLIP_TASKS_ENABLED === 'true';
    
    if (!FLIP_TASKS_ENABLED) {
      console.log(`Flip tasks API disabled, returning placeholder data for user ${userId}`);
      return res.json({
        assignedToMe: [],
        assignedByMe: [],
        available: [],
        total: 0,
        summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
      });
    }

    // Hilfsfunktion: Prüft ob ein Task für den User relevant ist
    async function checkIfTaskIsRelevantForUser(task, userId, allAssignments, userInfo = null) {
      // 1. Hat der Task ein Assignment für diesen User? (sollte bereits abgedeckt sein)
      const hasAssignment = allAssignments.some(a => a.task_id === task.id && a.user_id === userId);
      if (hasAssignment) {
        return true;
      }
      
      // 2. Wenn wir User-Info haben, prüfe ob der Name im Task-Titel vorkommt
      if (userInfo) {
        const { vorname, nachname } = userInfo;
        const taskTitle = task.title?.toLowerCase() || '';
        const taskBody = task.body?.plain?.toLowerCase() || '';
        
        const firstNameMatch = vorname && taskTitle.includes(vorname.toLowerCase());
        const lastNameMatch = nachname && taskTitle.includes(nachname.toLowerCase());
        const fullNameMatch = (vorname && nachname) && taskTitle.includes(`${vorname} ${nachname}`.toLowerCase());
        
        if (firstNameMatch || lastNameMatch || fullNameMatch) {
          console.log(`🎯 Task "${task.title}" matched user ${vorname} ${nachname} by name`);
          return true;
        }
        
        // Auch im Body prüfen (für Laufzettel etc.)
        const bodyFirstNameMatch = vorname && taskBody.includes(vorname.toLowerCase());
        const bodyLastNameMatch = nachname && taskBody.includes(nachname.toLowerCase());
        
        if (bodyFirstNameMatch || bodyLastNameMatch) {
          console.log(`🎯 Task "${task.title}" matched user ${vorname} ${nachname} in body`);
          return true;
        }
      }
      
      // 3. Vorerst keine anderen Kriterien
      return false;
    }

    try {
      console.log(`🔄 Comprehensive task loading for user: ${userId}`);
      
      // 0. User-Info aus der DB laden für Name-Matching
      let userInfo = null;
      try {
        userInfo = await Mitarbeiter.findOne({ flip_id: userId }).select('vorname nachname email');
        if (userInfo) {
          console.log(`👤 Found user info: ${userInfo.vorname} ${userInfo.nachname} (${userInfo.email})`);
        } else {
          console.log(`⚠️ No user found in DB with flip_id: ${userId}`);
        }
      } catch (dbError) {
        console.log(`⚠️ Could not load user from DB:`, dbError.message);
      }
      
      // 1. Alle Tasks ohne Filter abrufen
      console.log("📋 Fetching ALL tasks from Flip API...");
      const allTasksResponse = await flipAxios.get("/api/tasks/v4/tasks", {
        params: { body_format: "PLAIN" }
      });
      const allTasks = allTasksResponse.data?.tasks || [];
      console.log(`📊 Total tasks in Flip: ${allTasks.length}`);
      
      // 2. Alle Assignments abrufen
      console.log("📋 Fetching ALL assignments from Flip API...");
      const assignmentsResponse = await flipAxios.get("/api/tasks/v4/tasks/assignments", {
        params: { 
          distribution_kind: "RECEIVED,PERSONAL",
          body_format: "PLAIN"
        }
      });
      const allAssignments = assignmentsResponse.data?.assignments || [];
      console.log(`📊 Total assignments in Flip: ${allAssignments.length}`);
      
      const assignedToMe = [];
      const assignedByMe = [];
      const available = [];
      
      // 3. Tasks kategorisieren
      console.log(`🔄 Categorizing tasks for user ${userId}...`);
      
      for (const task of allTasks) {
        let processed = false;
        
        // Tasks die der User erstellt hat
        if (task.author_id === userId) {
          assignedByMe.push({
            id: task.id,
            title: task.title,
            body: {
              html: task.body?.html || "",
              plain: task.body?.plain || "",
              language: task.body?.language || null
            },
            progress_status: task.progress_status || "OPEN",
            due_at: task.due_at ? {
              date: task.due_at.date,
              type: task.due_at.type || "DATE"
            } : null,
            created_at: task.created_at,
            link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/${task.id}`,
            category: 'assignedByMe',
            author_id: task.author_id || null,
            source: 'authored'
          });
          processed = true;
        }
        
        // Tasks die dem User über Assignments zugewiesen sind
        const userAssignment = allAssignments.find(a => 
          a.task_id === task.id && a.user_id === userId
        );
        
        if (userAssignment && !processed) {
          assignedToMe.push({
            id: task.id,
            title: task.title,
            body: {
              html: task.body?.html || "",
              plain: task.body?.plain || "",
              language: task.body?.language || null
            },
            progress_status: userAssignment.progress_status || task.progress_status || "OPEN",
            due_at: task.due_at ? {
              date: task.due_at.date,
              type: task.due_at.type || "DATE"
            } : null,
            created_at: task.created_at,
            link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/${task.id}`,
            category: 'assignedToMe',
            author_id: task.author_id || null,
            assignment_id: userAssignment.id,
            source: 'assigned'
          });
          processed = true;
        }
        
        // Verfügbare Tasks: API-Client Tasks die an diese Person adressiert sind
        // (z.B. Laufzettel mit dem Namen der Person im Titel)
        if (!processed && task.author_id === 'c7310e42-b19d-432a-be5a-7211dc0f14b8') {
          // Prüfe ob der Task für diese Person relevant ist
          const isTaskRelevantForUser = await checkIfTaskIsRelevantForUser(task, userId, allAssignments, userInfo);
          
          console.log(`🔍 Task "${task.title}" relevant for user? ${isTaskRelevantForUser}`);
          
          if (isTaskRelevantForUser) {
            available.push({
              id: task.id,
              title: task.title,
              body: {
                html: task.body?.html || "",
                plain: task.body?.plain || "",
                language: task.body?.language || null
              },
              progress_status: task.progress_status || "OPEN",
              due_at: task.due_at ? {
                date: task.due_at.date,
                type: task.due_at.type || "DATE"
              } : null,
              created_at: task.created_at,
              link: `${process.env.FLIP_SYNC_URL || process.env.FLIP_BASE_URL || 'https://app.flip.de'}/tasks/${task.id}`,
              category: 'available',
              author_id: task.author_id || null,
              source: 'api-client-relevant'
            });
          }
        }
      }
      
      const response = {
        assignedToMe,
        assignedByMe,
        available,
        total: assignedToMe.length + assignedByMe.length + available.length,
        summary: {
          assignedToMe: assignedToMe.length,
          assignedByMe: assignedByMe.length,
          available: available.length
        },
        debug: {
          totalTasksInFlip: allTasks.length,
          totalAssignmentsInFlip: allAssignments.length,
          userAssignments: allAssignments.filter(a => a.user_id === userId).length,
          userAuthoredTasks: allTasks.filter(t => t.author_id === userId).length
        }
      };
      
      console.log(`✅ Comprehensive task loading completed for user ${userId}:`);
      console.log(`   📥 Assigned to me: ${response.summary.assignedToMe}`);
      console.log(`   📤 Assigned by me: ${response.summary.assignedByMe}`);
      console.log(`   📋 Available: ${response.summary.available}`);
      console.log(`   🔢 Total: ${response.total}`);
      
      res.json(response);
      
    } catch (error) {
      console.error(`❌ Error in comprehensive task loading for user ${userId}:`, error.response?.data || error.message);
      res.json({
        assignedToMe: [],
        assignedByMe: [],
        available: [],
        total: 0,
        summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
      });
    }
  })
);

// Create a Flip task
router.post(
  "/flip/tasks",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const taskData = req.body;
      if (!taskData.title || !taskData.recipients || taskData.recipients.length === 0) {
        return res.status(400).json({ message: "Title and at least one recipient are required" });
      }

      const newTask = await assignFlipTask({ body: taskData });
      res.status(201).json(newTask);
    } catch (err) {
      console.error("Error creating flip task:", err.response?.data || err.message);
      res.status(500).json({ message: "Error creating flip task" });
    }
  })
);

// Mark a Flip task as completed
router.post(
  "/flip/tasks/:taskId/complete",
  auth,
  asyncHandler(async (req, res) => {
    const taskId = req.params.taskId;
    try {
      const response = await flipAxios.post(`/api/tasks/v4/tasks/${taskId}/complete`);
      res.json(response.data);
    } catch (err) {
      console.error(`Error completing task ${taskId}:`, err.response?.data || err.message);
      res.status(500).json({ message: "Error completing task" });
    }
  })
);

router.get(
  "/flip/user-group-assignments",
  asyncHandler(async (req, res) => {
    const data = await getFlipUserGroupAssignments(req.query);
    res.status(200).json(data);
  })
);

// --- GET single Mitarbeiter by ID ---
router.get(
  "/mitarbeiter/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const mitarbeiter = await Mitarbeiter.findById(id)
      .populate([
        { 
          path: "laufzettel_received",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "laufzettel_submitted",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "eventreports",
          populate: { path: "teamleiter", select: "_id vorname nachname email" }
        },
        { 
          path: "evaluierungen_received",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "evaluierungen_submitted",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
      ]);

    if (!mitarbeiter) {
      return res.status(404).json({
        success: false,
        message: "Mitarbeiter nicht gefunden.",
      });
    }

    res.status(200).json({
      success: true,
      data: mitarbeiter,
    });
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
        { 
          path: "laufzettel_received",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "laufzettel_submitted",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "eventreports",
          populate: { path: "teamleiter", select: "_id vorname nachname email" }
        },
        { 
          path: "evaluierungen_received",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
        { 
          path: "evaluierungen_submitted",
          populate: [
            { path: "mitarbeiter", select: "_id vorname nachname email" },
            { path: "teamleiter", select: "_id vorname nachname email" }
          ]
        },
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

// --- Personalnr Update Endpoint ---
router.patch(
  "/mitarbeiter/:id/personalnr",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { personalnr } = req.body;

    try {
      const mitarbeiter = await Mitarbeiter.findById(id);

      if (!mitarbeiter) {
        return res.status(404).json({
          success: false,
          message: "Mitarbeiter mit dieser ID nicht gefunden.",
        });
      }

      // Check for conflicts (duplicate personalnr)
      if (personalnr?.trim()) {
        const existingWithSameNr = await Mitarbeiter.findOne({
          personalnr: personalnr.trim(),
          _id: { $ne: id }
        });

        if (existingWithSameNr) {
          return res.status(409).json({
            success: false,
            message: "Diese Personalnummer wird bereits von einem anderen Mitarbeiter verwendet.",
            conflict: {
              email: existingWithSameNr.email,
              name: `${existingWithSameNr.vorname} ${existingWithSameNr.nachname}`
            }
          });
        }
      }

      // Prepare update with history tracking
      const updateData = {
        personalnr: personalnr?.trim() || null
      };

      // Add to history if there was a previous value
      if (mitarbeiter.personalnr && mitarbeiter.personalnr !== personalnr?.trim()) {
        await Mitarbeiter.updateOne(
          { _id: id },
          {
            $set: { personalnr: personalnr?.trim() || null },
            $push: {
              personalnrHistory: {
                value: mitarbeiter.personalnr,
                updatedAt: new Date(),
                updatedBy: req.user?.email || 'user',
                source: 'manual'
              }
            }
          }
        );
      } else {
        await Mitarbeiter.updateOne(
          { _id: id },
          { $set: { personalnr: personalnr?.trim() || null } }
        );
      }

      const updatedMitarbeiter = await Mitarbeiter.findById(id);

      res.status(200).json({
        success: true,
        data: updatedMitarbeiter,
        message: "Personalnummer erfolgreich aktualisiert.",
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Diese Personalnummer wird bereits verwendet.",
        });
      }
      throw error;
    }
  })
);

// --- Add Additional Email to Mitarbeiter ---
router.post(
  "/mitarbeiter/:id/additional-email",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "E-Mail Adresse ist erforderlich.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check if email is already used as primary email
      const existingPrimary = await Mitarbeiter.findOne({ email: normalizedEmail });
      if (existingPrimary) {
        return res.status(409).json({
          success: false,
          message: "Diese E-Mail wird bereits als primäre E-Mail verwendet.",
          conflict: {
            name: `${existingPrimary.vorname} ${existingPrimary.nachname}`,
            email: existingPrimary.email
          }
        });
      }

      // Check if email is already in additionalEmails of another Mitarbeiter
      const existingAdditional = await Mitarbeiter.findOne({ 
        additionalEmails: normalizedEmail,
        _id: { $ne: id }
      });
      if (existingAdditional) {
        return res.status(409).json({
          success: false,
          message: "Diese E-Mail ist bereits einem anderen Mitarbeiter zugeordnet.",
          conflict: {
            name: `${existingAdditional.vorname} ${existingAdditional.nachname}`,
            email: existingAdditional.email
          }
        });
      }

      const mitarbeiter = await Mitarbeiter.findById(id);
      if (!mitarbeiter) {
        return res.status(404).json({
          success: false,
          message: "Mitarbeiter nicht gefunden.",
        });
      }

      // Check if already in this Mitarbeiter's additionalEmails
      if (mitarbeiter.additionalEmails?.includes(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Diese E-Mail ist bereits diesem Mitarbeiter zugeordnet.",
        });
      }

      // Add to additionalEmails
      await Mitarbeiter.updateOne(
        { _id: id },
        { $addToSet: { additionalEmails: normalizedEmail } }
      );

      const updatedMitarbeiter = await Mitarbeiter.findById(id);

      res.status(200).json({
        success: true,
        data: updatedMitarbeiter,
        message: `E-Mail ${normalizedEmail} wurde erfolgreich hinzugefügt.`,
      });
    } catch (error) {
      throw error;
    }
  })
);

// --- Remove Additional Email from Mitarbeiter ---
router.delete(
  "/mitarbeiter/:id/additional-email",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "E-Mail Adresse ist erforderlich.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const mitarbeiter = await Mitarbeiter.findById(id);
      if (!mitarbeiter) {
        return res.status(404).json({
          success: false,
          message: "Mitarbeiter nicht gefunden.",
        });
      }

      await Mitarbeiter.updateOne(
        { _id: id },
        { $pull: { additionalEmails: normalizedEmail } }
      );

      const updatedMitarbeiter = await Mitarbeiter.findById(id);

      res.status(200).json({
        success: true,
        data: updatedMitarbeiter,
        message: `E-Mail ${normalizedEmail} wurde entfernt.`,
      });
    } catch (error) {
      throw error;
    }
  })
);

router.get(
  "/mitarbeiter/by-name/:name",
  auth,
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name parameter is required.",
      });
    }

    try {
      // Split name into parts and try to find by vorname nachname combination
      const nameParts = name.trim().split(/\s+/);
      let mitarbeiter = null;

      if (nameParts.length >= 2) {
        const vorname = nameParts[0];
        const nachname = nameParts.slice(1).join(' ');
        
        // Try exact match first
        mitarbeiter = await Mitarbeiter.findOne({
          vorname: { $regex: new RegExp(`^${vorname}$`, 'i') },
          nachname: { $regex: new RegExp(`^${nachname}$`, 'i') }
        }).select('_id flip_id asana_id vorname nachname email isActive');
      }

      // If not found, try matching the full name
      if (!mitarbeiter) {
        mitarbeiter = await Mitarbeiter.findOne({
          $or: [
            { vorname: { $regex: new RegExp(name, 'i') } },
            { nachname: { $regex: new RegExp(name, 'i') } },
            { email: { $regex: new RegExp(name, 'i') } }
          ]
        }).select('_id flip_id asana_id vorname nachname email isActive');
      }

      if (!mitarbeiter) {
        return res.status(404).json({
          success: false,
          message: `Mitarbeiter "${name}" not found.`,
        });
      }

      res.status(200).json({
        success: true,
        data: mitarbeiter,
      });
    } catch (error) {
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

// SSE-Route

router.get("/sse-mailstatus", (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ msg: "Kein Token übergeben" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user._id || decoded.user.id;
    console.log("➡ SSE gestartet für:", userId);

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();

    progressMap.set(userId, res);

    req.on("close", () => {
      progressMap.delete(userId);
    });
  } catch (err) {
    console.error("❌ Invalid token in SSE route:", err.message);
    return res.status(401).json({ msg: "Ungültiger Token" });
  }
});

function getEmailTemplate(type, data) {
  const { vorname, monatLesbar, jahr, stadt_full, stadtVars } = data;
      let anrede = "";
      switch(type){
        case "LA": anrede = `<p>Hallo ${vorname},</p>
    <p>anbei deine Lohnabrechnung für ${monatLesbar} ${jahr}.</p>`;
    break;
        case "LST": anrede = `<p>Hallo ${vorname},</p>
    <p>anbei dein Lohnsteuerbescheid für ${monatLesbar} ${jahr}.</p>`;
    break;
    default: anrede = `<p>Hallo ${vorname},</p>
    <p>anbei dein Dokument für ${monatLesbar} ${jahr}.</p>`;
      }

      return `
         <div style="font-family: Arial, sans-serif; font-size: 11pt; color: #333;">
    ${anrede}
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
  </div>`;
  
}

router.post(
  "/upload-lohnabrechnungen",
  auth,
  multer({ storage }).fields([
    { name: "pdf", maxCount: 1 },
    { name: "excel", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    try {
      const { stadt, monat, stadt_full, dokumentart } = req.body;
      const pdfBuffer = req.files?.pdf?.[0]?.buffer;
      const excelBuffer = req.files?.excel?.[0]?.buffer;

      if (
        !pdfBuffer ||
        !excelBuffer ||
        !stadt ||
        !monat ||
        !stadt_full ||
        !dokumentart
      ) {
        return res.status(400).json({ error: "Fehlende Daten" });
      }

      const originalPdf = await PDFDocument.load(pdfBuffer);
      const pageCount = originalPdf.getPageCount();

      const workbook = xlsx.read(excelBuffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const data = rows
        .slice(1)
        .filter((row) =>
          row.some((cell) => cell !== null && String(cell).trim() !== "")
        )
        .sort((a, b) =>
          normalizeUmlautsForSort(a[1])?.localeCompare(
            normalizeUmlautsForSort(b[1])
          )
        );

      if (pageCount !== data.length) {
        return res
          .status(400)
          .json({ error: "PDF und Excel stimmen nicht überein." });
      }

      const zip = new JSZip();
      const jahr = new Date().getFullYear();
      const monatLesbar = MONATSNAMEN[monat.padStart(2, "0")] || monat;
      const stadtVars = STADT_TEMPLATE_VARS[stadt_full];

      if (!stadtVars) {
        return res
          .status(400)
          .json({ error: `Unbekannter Standort: ${stadt_full}` });
      }

      for (let i = 0; i < data.length; i++) {
        console.log(data[i]);
        const row = data[i];
        const rawNachname = (row[1] || "Unbekannt").trim();
        const rawVorname = (row[2] || "Mitarbeiter").trim();

        const safeVorname = rawVorname
          .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
          .replace(/\s+/g, "_");
        const safeNachname = rawNachname
          .replace(/[^a-zA-ZäöüÄÖÜß]/g, "")
          .replace(/\s+/g, "_");
        const email = row[4] || null;

        const outputPdf = await PDFDocument.create();
        const [page] = await outputPdf.copyPages(originalPdf, [i]);
        outputPdf.addPage(page);

        const fileBuffer = await outputPdf.save();
        const filename = `${safeNachname}_${safeVorname}_${dokumentart}_${stadt}_${monat}.pdf`;

        zip.file(filename, fileBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=Abrechnungen_${stadt}_${monat}.zip`,
      });
      res.send(zipBuffer);

      const userId = req.user?.id?.toString() || "default";
      console.log(userId);
      setImmediate(async () => {
        try {
          await sendAllMailsInBackground(
            data,
            userId,
            originalPdf,
            stadtVars,
            monatLesbar,
            jahr,
            stadt_full,
            stadt,
            dokumentart
          );
        } catch (err) {
          console.error("Fehler im asynchronen Mailversand:", err.message);
        }
      });
    } catch (err) {
      console.error("❌ Fehler beim Upload:", err);
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
      personalnr,
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
        
        // Update personalnr - always set if provided
        if (personalnr) {
          mitarbeiter.personalnr = personalnr.trim();
        }
        
        await mitarbeiter.save();
      } else {
        // Mitarbeiter neu erstellen
        mitarbeiter = new Mitarbeiter({
          asana_id: asana_id || undefined,
          vorname: first_name,
          nachname: last_name,
          email: normalizedEmail,
          personalnr: personalnr?.trim() || null,
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

// Delete Flip User
router.post(
  "/flip/exit",
  asyncHandler(async (req, res) => {
    let userList = req.body.filter((user) => user && user.vorname && user.nachname);
    console.log(`👥 Eingehende Benutzer zur Löschung: ${userList.length}`);

    let flipUsers;
    try {
      console.log("🔄 Lade Flip-User...");
      flipUsers = await getFlipUsers();
      console.log(`✅ ${flipUsers.length} Flip-User empfangen.`);
    } catch (error) {
      console.error("❌ Fehler beim Abrufen der Flip-User:", error);
      return res.status(500).json({ error: "Fehler beim Abrufen der Flip-User." });
    }

    const normalizedUsers = flipUsers
      .filter((u) => u.first_name && u.last_name)
      .map((user) => ({
        id: user.id,
        fullName: `${user.first_name} ${user.last_name}`.toLowerCase().trim(),
        vorname: user.first_name.toLowerCase().trim(),
        nachname: user.last_name.toLowerCase().trim(),
      }));

    const foundIds = [];
    const notFound = [];

    for (const { vorname, nachname } of userList) {
      const inputName = `${vorname} ${nachname}`.toLowerCase().trim();
      console.log(`🔍 Suche nach Flip-User für: ${inputName}`);

      // 1. Exact match
      let match = normalizedUsers.find((u) =>
        u.fullName.replace(/\s+/g, "") === inputName.replace(/\s+/g, "")
      );

      // 2. Last name + partial first name
      if (!match) {
        const inputParts = inputName.split(/\s+/);
        const inputLast = inputParts[inputParts.length - 1];
        const inputFirst = inputParts.slice(0, -1).join(" ");
        match = normalizedUsers.find(
          (u) => u.nachname === inputLast && u.vorname.includes(inputFirst)
        );
      }

      // 3. Similarity fallback
      if (!match) {
        const nameList = normalizedUsers.map((u) => u.fullName);
        const similarityMatch = stringSimilarity.findBestMatch(inputName, nameList);
        if (similarityMatch.bestMatch.rating > 0.8) {
          match = normalizedUsers[similarityMatch.bestMatchIndex];
          console.log(`🤖 Ähnlichkeits-Treffer: ${match.fullName} (${similarityMatch.bestMatch.rating})`);
        }
      }

      if (match) {
        foundIds.push(match.id);
        console.log(`✅ Flip-User gefunden: ${match.fullName}`);
      } else {
        notFound.push(`${vorname} ${nachname}`);
        console.warn(`❌ Kein Flip-User gefunden für: ${vorname} ${nachname}`);
      }
    }

    if (foundIds.length > 0) {
      try {
        await deleteManyFlipUsers(foundIds);
        console.log("🧹 Erfolgreich gelöscht:", foundIds.length);
      } catch (error) {
        console.error("❌ Fehler beim Löschen:", error);
        return res.status(500).json({ error: "Fehler beim Löschen.", notFound });
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
