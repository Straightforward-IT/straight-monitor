const express = require("express");
const router = express.Router();
const Asana = require("asana");
require('dotenv').config();

function initApi() {
  let client = Asana.ApiClient.instance;
  let token = client.authentications["token"];
  token.accessToken = process.env.ASANA_PAT;
  return new Asana.TasksApi();
}

router.get("/schulungenTasks", async (req, res) => {
  let opts = {   
    'project': "1207931820284879", 
    'completed_since': new Date().toISOString(),  
    'opt_fields': "assignee, assignee_status, completed, completed_at, completed_by, created_at, created_by, due_at, due_on, followers, html_notes, memberships, modified_at, name, notes, parent, permalink_url, projects"
};
 let result = await findTasks(opts);
 console.log(result.length);
 res.status(200).json({ message: "Assignment successful", task: result });
});

router.put("/updateTask/:gid", async (req, res) => {
  let body = {"data": req.body};
  let gid = req.params.gid;
  body.data.html_notes = `<body><a href="https://straightmonitor.com/mitarbeiter/create/${gid}">Bewerber erstellen</a></body>`
  let opts = {};
  console.log(body);
  console.log(body.data);
  console.log(body.data.html_notes);
  let response = await updateTask(body, gid, opts);
  res.status(200).json(response);
  
});

router.get("/task/:id", async (req, res) => {
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
});

router.post("/task", async (req, res) => {
  let tasksApiInstance = initApi();
  let body = {"data": req.body};
  let opts = {};

  tasksApiInstance.createTask(body, opts).then((result) => {
    res.status(200).json(result);
  },
(error) => {
  console.error(error.response.body);
})
});

async function findTasks(opts) {
  let tasksApiInstance = initApi();

  try {
    const result = await tasksApiInstance.getTasks(opts);
    const filteredresults = [];

    if (result?.data && Array.isArray(result.data)) {
      for (const task of result.data) {
        if (!task.html_notes?.includes("Bewerber erstellen</a>")) {
          console.log(`Task: ${task.gid} erhält einen a-tag`);
          console.log(task.html_notes);
    
          // Ensure html_notes is a string
          let html = task.html_notes || "";
    
          // Handle existing <body> tags
          let updatedHtmlNotes;
          if (html.includes("<body>")) {
            // Append the new <a> tag inside the existing <body> tag
            updatedHtmlNotes = html.replace(
              /<\/body>/,
              `<a href="https://straightmonitor.com/mitarbeiter/create/${task.gid}">Bewerber erstellen</a></body>`
            );
          } else {
            // Wrap the entire content in a single <body> tag
            updatedHtmlNotes = `<body>${html}<a href="https://straightmonitor.com/mitarbeiter/create/${task.gid}">Bewerber erstellen</a></body>`;
          }
    
          try {
            const body = {
              data: {
                html_notes: updatedHtmlNotes,
              },
            };
    
            // Call updateTask
            const response = await tasksApiInstance.updateTask(task.gid, body);
            filteredresults.push(response);
          } catch (updateError) {
            console.error(`Error updating task ${task.gid}:`, updateError.response?.body || updateError.message);
          }
        }
      }
    } else {
      console.error("Unexpected response format:", result);
    }
  } catch (error) {
    console.error("Error fetching tasks:", error.response?.body || error.message);
  }
}

async function updateTask(data, gid, opts) {
  const tasksApiInstance = initApi();
  tasksApiInstance.updateTask(data, gid, opts).then((result) => {
    //console.log('API called successfully. Returned data: ' + JSON.stringify(result.data, null, 2));
    return result;
}, (error) => {
    console.error(error.response.body);
});
}
module.exports = router;
