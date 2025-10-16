const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/AsyncHandler");
const { flipAxios } = require("../flipAxios");
const FlipTask = require("../models/Classes/FlipTask");

// Route zum Abrufen aller Tasks für einen bestimmten Benutzer
router.get(
  "/:userId",
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID ist erforderlich" });
    }
    
    try {
      // Tasks für diesen Benutzer abrufen
      const response = await flipAxios.get("/api/tasks/v4/tasks", {
        params: { 
          assignee: userId,
          // Nur aktive/offene Tasks abrufen (optionales Filter)
          status: ["TO_DO", "IN_PROGRESS", "BLOCKED"]
        }
      });
      
      if (!response.data || !response.data.tasks) {
        return res.json([]);
      }
      
      // Antwort in ein benutzerfreundlicheres Format umwandeln
      const tasks = response.data.tasks.map(task => {
        return {
          id: task.id,
          title: task.title,
          description: task.body?.html || "",
          status: task.progress_status || "TO_DO",
          due_date: task.due_at?.date || null,
          created_at: task.created_at,
          link: `${process.env.FLIP_SYNC_URL}/tasks/${task.id}`
        };
      });
      
      res.json(tasks);
    } catch (error) {
      console.error(`Fehler beim Abrufen der Tasks für Benutzer ${userId}:`, error);
      res.status(500).json({ message: "Fehler beim Abrufen der Tasks von Flip" });
    }
  })
);

// Route zum Erstellen eines neuen Tasks
router.post(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const taskData = req.body;
      
      if (!taskData.title || !taskData.recipients || taskData.recipients.length === 0) {
        return res.status(400).json({ message: "Titel und mindestens ein Empfänger sind erforderlich" });
      }
      
      const newTask = new FlipTask(taskData);
      const createdTask = await newTask.create();
      
      res.status(201).json(createdTask.toSimplifiedObject());
    } catch (error) {
      console.error("Fehler beim Erstellen eines Tasks:", error);
      res.status(500).json({ message: "Fehler beim Erstellen eines Tasks" });
    }
  })
);

// Route zum Markieren eines Tasks als abgeschlossen
router.post(
  "/:taskId/complete",
  auth,
  asyncHandler(async (req, res) => {
    const taskId = req.params.taskId;
    
    try {
      const response = await flipAxios.post(`/api/tasks/v4/tasks/${taskId}/complete`);
      res.json(response.data);
    } catch (error) {
      console.error(`Fehler beim Abschließen des Tasks ${taskId}:`, error);
      res.status(500).json({ message: "Fehler beim Abschließen des Tasks" });
    }
  })
);

module.exports = router;