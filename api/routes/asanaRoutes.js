const express = require("express");
const router = express.Router();
const Asana = require("asana");
require('dotenv').config();

router.get("/schulungenTasks", async (req, res) => {
  let client = Asana.ApiClient.instance;
  let token = client.authentications["token"];
  token.accessToken = process.env.ASANA_PAT;

  let tasksApiInstance = new Asana.TasksApi();
  let project_gid = "1206622996192570"; // String | Globally unique identifier for the project.
  let opts = {};
  tasksApiInstance.getTasksForProject(project_gid, opts).then(
    (result) => {
      res.status(200).json(result);
    },
    (error) => {
      console.error(error.response.body);
    }
  );
});

module.exports = router;
