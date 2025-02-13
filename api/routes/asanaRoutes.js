const express = require("express");
const router = express.Router();
const Asana = require("asana");
const asyncHandler = require("../middleware/AsyncHandler");
require('dotenv').config();

function initApi() {
  let client = Asana.ApiClient.instance;
  let token = client.authentications["token"];
  token.accessToken = process.env.ASANA_PAT;
  return new Asana.TasksApi();
}

router.get("/schulungenTasks", asyncHandler( async (req, res) => {
  let opts = {   
    'project': "1207931820284879", 
    'completed_since': new Date().toISOString(),  
    'opt_fields': "assignee, assignee_status, completed, completed_at, completed_by, created_at, created_by, due_at, due_on, followers, html_notes, memberships, modified_at, name, notes, parent, permalink_url, projects"
};
 let result = await findTasks(opts);
 console.log(result.length);
 res.status(200).json({ message: "Assignment successful", task: result });
}));

router.put("/updateTask/:gid", asyncHandler( async (req, res) => {
  let body = {"data": req.body};
  let gid = req.params.gid;
  body.data.html_notes = `<body><a href="https://straightmonitor.com/mitarbeiter/create/${gid}">Bewerber erstellen</a></body>`
  let opts = {};
  console.log(body);
  console.log(body.data);
  console.log(body.data.html_notes);
  let response = await updateTask(body, gid, opts);
  res.status(200).json(response);
  
}));

router.get("/task/:id", asyncHandler( async (req, res) => {
  let tasksApiInstance = initApi();
  let task_gid = req.params.id;

  let opts = {};
  tasksApiInstance.getTask(task_gid, opts).then(
    (result) => {
      res.status(200).json(result);
    },
    (error) => {
      console.error(error.response.body);
    }
  )
}));

router.post("/task", asyncHandler( async (req, res) => {
  let tasksApiInstance = initApi();
  let body = {"data": req.body};
  let opts = {};

  tasksApiInstance.createTask(body, opts).then((result) => {
    res.status(200).json(result);
  },
(error) => {
  console.error(error.response.body);
})
}));

// 📌 Fetch & Update Tasks with Error Handling
async function findTasks(opts) {
  const tasksApiInstance = initApi();
  const filteredResults = [];

  try {
      const result = await tasksApiInstance.getTasks(opts);

      if (result?.data && Array.isArray(result.data)) {
          for (const task of result.data) {
              if (!task.html_notes?.includes("Bewerber erstellen</a>")) {
                  console.log(`Task: ${task.gid} erhält einen a-tag`);
                  
                  let html = task.html_notes || "";
                  let updatedHtmlNotes = html.includes("<body>")
                      ? html.replace("</body>", `<a href="https://straightmonitor.com/mitarbeiter/create/${task.gid}">Bewerber erstellen</a></body>`)
                      : `<body>${html}<a href="https://straightmonitor.com/mitarbeiter/create/${task.gid}">Bewerber erstellen</a></body>`;

                  try {
                      const body = { data: { html_notes: updatedHtmlNotes } };
                      const response = await updateTask(task.gid, body);
                      filteredResults.push(response);
                  } catch (updateError) {
                      console.error(`❌ Error updating task ${task.gid}:`, updateError.response?.body || updateError.message);
                      throw new Error(`Failed to update task ${task.gid}`);
                  }
              }
          }
      } else {
          console.error("❌ Unexpected response format:", result);
          throw new Error("Unexpected response from Asana API");
      }
  } catch (error) {
      console.error("❌ Error fetching tasks:", error.response?.body || error.message);
      throw new Error("Failed to fetch tasks from Asana");
  }

  return filteredResults;
}

// 📌 Update Task with Proper Error Handling
async function updateTask(gid, data) {
  const tasksApiInstance = initApi();

  try {
      const response = await tasksApiInstance.updateTask(gid, data);
      return response;
  } catch (error) {
      console.error(`❌ Error updating task ${gid}:`, error.response?.body || error.message);
      throw new Error(`Failed to update task ${gid}`);
  }
}

module.exports = router;
