const Asana = require("asana");
require("dotenv").config();
const { sendMail } = require("./EmailService"); // Ensure sendMail is properly imported

/**
 * Initialize Asana API Client
 */
function initApi() {
    let client = Asana.ApiClient.instance;
    let token = client.authentications["token"];
    token.accessToken = process.env.ASANA_PAT;
    return new Asana.TasksApi();
}

// Queue for rate-limited updates
const updateQueue = [];
const maxConcurrentRequests = 15;
let activeRequests = 0;

/**
 * Adds a task update request to the queue
 */
function queueTaskUpdate(task_gid, newHtmlNotes) {
    updateQueue.push({ task_gid, newHtmlNotes });
}

/**
 * Processes the queue at a controlled rate
 */
async function processQueue() {
    if (activeRequests >= maxConcurrentRequests || updateQueue.length === 0) {
        return;
    }

    const { task_gid, newHtmlNotes } = updateQueue.shift();
    activeRequests++;

    try {
        await updateTaskHtmlNotes(task_gid, newHtmlNotes);
    } catch (error) {
        console.error(`❌ Failed to update task ${task_gid}:`, error.message);
        if (error.response?.status === 429) {
            console.warn(`⏳ Rate limit exceeded for ${task_gid}. Re-queuing.`);
            queueTaskUpdate(task_gid, newHtmlNotes);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
        }
    } finally {
        activeRequests--;
    }
}

// Run queue processor every 500ms
setInterval(processQueue, 500);

/**
 * Fetch all tasks for a given project, handling pagination.
 * @param {Object} opts - The query parameters (must include project ID).
 * @returns {Array} - A list of all tasks.
 */
async function findAllTasks(opts) {
    const tasksApiInstance = initApi();
    let allTasks = [];
    let nextPageOffset = null;

    if (!opts.project) {
        throw new Error("Project ID is required to fetch tasks.");
    }

    try {
        do {
            const queryOpts = { ...opts, limit: 100 };
            if (nextPageOffset) queryOpts.offset = nextPageOffset;

            console.log("Fetching tasks with opts:", queryOpts);

            const response = await tasksApiInstance.getTasks(queryOpts);
            if (response?.data) {
                allTasks.push(...response.data);
            }

            nextPageOffset = response?.next_page?.offset || null;
        } while (nextPageOffset);

        console.log(`✅ Retrieved ${allTasks.length} tasks.`);
        return allTasks;
    } catch (error) {
        console.error("❌ Error fetching tasks:", error.response?.body || error.message);
        throw new Error("Failed to fetch tasks from Asana");
    }
}

/**
 * Fetch tasks based on given options
 */
async function findTasks(opts) {
    const tasksApiInstance = initApi();
    try {
        const result = await tasksApiInstance.getTasks(opts);
        return result?.data || [];
    } catch (error) {
        console.error("❌ Error fetching tasks:", error.response?.body || error.message);
        throw new Error("Failed to fetch tasks from Asana");
    }
}

/**
 * Update a Task's HTML Notes
 */
async function updateTaskHtmlNotes(task_gid, newHtmlNotes) {
    const tasksApiInstance = initApi();

    try {
        if (!task_gid || typeof newHtmlNotes !== "string" || newHtmlNotes.trim() === "") {
            throw new Error(`Invalid parameters: task_gid=${task_gid}, newHtmlNotes=${newHtmlNotes}`);
        }

        console.log(`🔄 Updating task: ${task_gid} with new notes...`);

        const body = {
            data: { html_notes: newHtmlNotes }
        };
        console.log(body);
        const response = await tasksApiInstance.updateTask(body, task_gid, {});
        console.log(`✅ Task ${task_gid} updated successfully.`);

        return response;
    } catch (error) {
        if (error.response?.status === 429) {
            console.warn(`⏳ Rate limit exceeded. Retrying task ${task_gid} in 5 seconds...`);
            queueTaskUpdate(task_gid, newHtmlNotes);
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            console.error(`❌ Failed to update task ${task_gid}:`, error.response?.data || error.message);
            console.log(error);
        }
    }
}


/**
 * Adds Bewerber erstellen link to a task if not already present
 */
async function addLinkToTask(task) {
    if (!task.html_notes?.includes("Bewerber erstellen</a>")) {
        console.log(`Task: ${task.gid} erhält einen a-tag`);
        console.log("Before formatting:", task.html_notes);

        let html = task.html_notes || "";

        // Convert newlines to <br> for proper HTML formatting
        // html = html.replace(/\n/g, " ").trim();

        let updatedHtmlNotes = html.includes("<body>")
    ? html.replace("<body>", `<body><h1><a href="https://straightmonitor.com/flip/benutzer-erstellen/${task.gid}">Bewerber erstellen</a></h1> \n`)
    : `<body><h1><a href="https://straightmonitor.com/flip/benutzer-erstellen/${task.gid}">Bewerber erstellen</a></h1>${html}</body>`;

        console.log("After formatting:", updatedHtmlNotes);
        queueTaskUpdate(task.gid, updatedHtmlNotes);
    }
}


/**
 * Routine to check tasks and append the link if missing
 */
async function bewerberRoutine() {
    const project_ids = ["1204666703404588", "1203882527761007", "1207192167671531"];

    try {
        for (const id of project_ids) { 
            const opts = {
                project: id, 
                completed_since: new Date().toISOString(),
                opt_fields: "gid, html_notes",
            };

            let tasks = await findTasks(opts);
            let tasksToUpdate = tasks.filter(task => !task.html_notes?.includes("Bewerber erstellen</a>"));

            tasksToUpdate.forEach(addLinkToTask);

            console.log(`✅ ${tasksToUpdate.length} tasks queued for project ${id}.`);
        }
    } catch (error) {
        console.error("❌ Error in Bewerber Routine:", error.message);
        await sendMail("it@straightforward.email", "❌ Bewerber Routine Failed", `
          <h3>Error in Bewerber Routine</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        `);
    }
}

/**
 * Fetch a single task by its GID.
 * @param {string} task_gid - The task GID from Asana.
 * @returns {Object} - The task data from Asana.
 */
async function getTaskById(task_gid) {
    const tasksApiInstance = initApi();
    
    let opts = { 
        'opt_fields': "gid,name,assignee,assignee.name,completed,completed_at,created_at,custom_fields,custom_fields.name,custom_fields.text_value,due_on,html_notes,memberships,memberships.project,memberships.project.name,notes,permalink_url"
    };

    try {
        const result = await tasksApiInstance.getTask(task_gid, opts);
        return result?.data || null;
    } catch (error) {
        console.error(`❌ Error fetching task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch task from Asana");
    }
}

module.exports = { findTasks, findAllTasks, updateTaskHtmlNotes, addLinkToTask, bewerberRoutine, getTaskById };
