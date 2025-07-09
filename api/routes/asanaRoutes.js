const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/AsyncHandler");
const { findTasks, getTaskById, getStoryById, getStoriesByTask, findAllTasks, updateTask, addLinkToTask, bewerberRoutine, createStoryOnTask} = require("../AsanaService");



/**
 * Route: Fetch all tasks from a project, handling pagination
 */
router.get("/tasks", asyncHandler(async (req, res) => {
  const opts = req.query; // Get query params (must include project)

  try {
      const tasks = await findAllTasks(opts);
      res.status(200).json({ message: "Tasks retrieved", tasks });
  } catch (error) {
      res.status(500).json({ message: "Error retrieving tasks", error: error.message });
  }
}));

router.get("/task/:id", asyncHandler(async (req, res) => {
    const taskId = req.params.id;
        const task = await getTaskById(taskId);

        if (!task) {
            return res.status(404).json({ message: `Task with ID ${taskId} not found.` });
        }
        res.status(200).json({ message: "Task retrieved successfully", task });
}));


router.put("/schulungenTasks", asyncHandler(async (req, res) => {
    const opts = {   
        project: "1207931820284879", 
        completed_since: new Date().toISOString(),  
        opt_fields: "assignee, assignee_status, completed, completed_at, completed_by, created_at, created_by, due_at, due_on, followers, html_notes, memberships, modified_at, name, notes, parent, permalink_url, projects"
    };

    let tasks = await findTasks(opts);
    let updatedTasks = await Promise.all(tasks.map(addLinkToTask)); // Add links where needed

    console.log(`✅ ${updatedTasks.length} tasks processed.`);
    res.status(200).json({ message: "Assignment successful", tasks: updatedTasks });
}));

/**
 * Route: Update Task by GID
 */
router.put("/updateTask/:gid", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const htmlNotes = `<body><a href="https://straightmonitor.com/mitarbeiter/create/${gid}">Bewerber erstellen</a></body>`;

    await updateTask(gid, { html_notes: htmlNotes});
    res.status(200).json({ message: `✅ Task ${gid} updated successfully.` });
}));

router.patch("/updateTask/:gid", asyncHandler(async (req, res) => {
  const { gid } = req.params;
  const updateData = req.body;

  // Validate that there is data in the body to update with
  if (!updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Request body cannot be empty. Please provide fields to update.",
    });
  }

  try {
    const response = await updateTask(gid, updateData);
    
    res.status(200).json({
      success: true,
      message: `Task ${gid} updated successfully.`,
      data: response.data // Send back the updated task from Asana
    });
  } catch (error) {
    // The asyncHandler will forward the error, but we can add specific logging
    console.error(`Error in PATCH /updateTask/${gid}:`, error.message);
    // Let asyncHandler handle the response
    throw error;
  }
}));
/**
 * Route: Run Bewerber Routine (updates all necessary tasks)
 */
router.post("/bewerberRoutine", asyncHandler(async (req, res) => {
    await bewerberRoutine();
    res.status(200).json({ message: "✅ Bewerber routine executed successfully." });
}));

router.get("/story/:gid", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const story = await getStoryById(gid);

    if(!story) {
        return res.status(404).json({ message: "Not found"});
    }f
    res.status(200).json({ message: "Success: ", story});
}))

router.get("/task/:gid/stories", asyncHandler(async (req, res) => {
    const gid = req.params.gid;
    const stories = await getStoriesByTask(gid);

    if(!stories) {
        return res.status(404).json({ message: "Not found"});
    }
    res.status(200).json({ message: "Success: ", stories});
}));

router.post("/task/:gid/story", asyncHandler(async (req, res) => {
    const {  html_text } = req.body;
    const task_gid = req.params.gid;

    if (!task_gid || !html_text) {
      return res.status(400).json({
        success: false,
        message: "task_gid and html_text are required fields.",
      });
    }
  
    const data = {
      type: "comment",
      html_text: html_text,
    };
  
    try {
      const response = await createStoryOnTask(task_gid, data);
  
      if (!response || response.status !== 201) {
        return res.status(500).json({
          success: false,
          message: "Failed to create story on task.",
          response,
        });
      }
  
      res.status(201).json({
        success: true,
        message: "Story created successfully.",
        data: response.data || response,
      });
    } catch (error) {
      console.error("❌ Error creating story:", error.message);
      res.status(500).json({
        success: false,
        message: "Internal server error while creating story.",
        error: error.message,
      });
    }
  }));

module.exports = router;
