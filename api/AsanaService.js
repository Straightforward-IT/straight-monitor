const Asana = require("asana");
require("dotenv").config();

function initApi() {
    let client = Asana.ApiClient.instance;
    let token = client.authentications["token"];
    token.accessToken = process.env.ASANA_PAT;
    return new Asana.TasksApi();
}


async function updateTaskHtmlNotes(task_gid, newHtmlNotes) {
    const tasksApiInstance = initApi();
  
    try {
        const body = {
            data: {
                html_notes: newHtmlNotes, 
            },
        };
  
        await tasksApiInstance.updateTask(task_gid, body); 
        console.log(`Task ${task_gid} updated successfully.`);
    } catch (error) {
        console.error(`Failed to update task ${task_gid}:`, error.response?.body || error.message);
    }
  }

// Routine to check tasks and append the link if missing
function bewerberRoutine() {
    const tasksApiInstance = initApi();
    const projectId = "1206622996192570"; // The project ID
    const opts = {
        project: projectId,
        completed_since: new Date().toISOString(),
        opt_fields: "gid,html_notes",
    };

    return tasksApiInstance.getTasks(opts).then(
        (result) => {
            if (result?.data && Array.isArray(result.data)) {
                const tasksToUpdate = result.data.filter(
                    (task) => !task.html_notes.includes("Bewerber erstellen</a>")
                );

                const updatePromises = tasksToUpdate.map((task) => {
                    const updatedHtmlNotes = `${task.html_notes}<body><a href="https://straightmonitor.com/mitarbeiter/create/${task.gid}">Bewerber erstellen</a></body>`;
                    return updateTaskHtmlNotes(task.gid, updatedHtmlNotes);
                });

                Promise.all(updatePromises).then(() => {
                    console.log(`${tasksToUpdate.length} tasks updated.`);
                });
            } else {
                console.log("No tasks found to update or unexpected response format.");
            }
        },
        (error) => {
            console.error("Error fetching tasks:", error.response?.body || error.message);
        }
    );
}


module.exports = { bewerberRoutine };