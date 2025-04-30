const Asana = require("asana");
require("dotenv").config();
const { sendMail } = require("./EmailService");

/**
 * Initialize Asana API Client
 */
function initApi() {
    let client = Asana.ApiClient.instance;
    let token = client.authentications["token"];
    token.accessToken = process.env.ASANA_PAT;
    return new Asana.TasksApi();
}

function initStoryApi() {
    let client = Asana.ApiClient.instance;
    let token = client.authentications['token'];
    token.accessToken = process.env.ASANA_PAT;
    return new Asana.StoriesApi();
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
    const project_ids = ["1204666703404588", "1203882527761007", "1207192167671531", "1209986644355933"];

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

async function getStoryById(story_gid) {
    const storiesApiInstance = initStoryApi();
    let opts = { 
        'opt_fields': "assignee,assignee.name,created_at,created_by,created_by.name,custom_field,custom_field.date_value,custom_field.date_value.date,custom_field.date_value.date_time,custom_field.display_value,custom_field.enabled,custom_field.enum_options,custom_field.enum_options.color,custom_field.enum_options.enabled,custom_field.enum_options.name,custom_field.enum_value,custom_field.enum_value.color,custom_field.enum_value.enabled,custom_field.enum_value.name,custom_field.id_prefix,custom_field.is_formula_field,custom_field.multi_enum_values,custom_field.multi_enum_values.color,custom_field.multi_enum_values.enabled,custom_field.multi_enum_values.name,custom_field.name,custom_field.number_value,custom_field.representation_type,custom_field.text_value,custom_field.type,dependency,dependency.created_by,dependency.name,dependency.resource_subtype,duplicate_of,duplicate_of.created_by,duplicate_of.name,duplicate_of.resource_subtype,duplicated_from,duplicated_from.created_by,duplicated_from.name,duplicated_from.resource_subtype,follower,follower.name,hearted,hearts,hearts.user,hearts.user.name,html_text,is_editable,is_edited,is_pinned,liked,likes,likes.user,likes.user.name,new_approval_status,new_date_value,new_dates,new_dates.due_at,new_dates.due_on,new_dates.start_on,new_enum_value,new_enum_value.color,new_enum_value.enabled,new_enum_value.name,new_multi_enum_values,new_multi_enum_values.color,new_multi_enum_values.enabled,new_multi_enum_values.name,new_name,new_number_value,new_people_value,new_people_value.name,new_resource_subtype,new_section,new_section.name,new_text_value,num_hearts,num_likes,old_approval_status,old_date_value,old_dates,old_dates.due_at,old_dates.due_on,old_dates.start_on,old_enum_value,old_enum_value.color,old_enum_value.enabled,old_enum_value.name,old_multi_enum_values,old_multi_enum_values.color,old_multi_enum_values.enabled,old_multi_enum_values.name,old_name,old_number_value,old_people_value,old_people_value.name,old_resource_subtype,old_section,old_section.name,old_text_value,previews,previews.fallback,previews.footer,previews.header,previews.header_link,previews.html_text,previews.text,previews.title,previews.title_link,project,project.name,resource_subtype,source,sticker_name,story,story.created_at,story.created_by,story.created_by.name,story.resource_subtype,story.text,tag,tag.name,target,target.created_by,target.name,target.resource_subtype,task,task.created_by,task.name,task.resource_subtype,text,type"
    };
    try{
        const result = await storiesApiInstance.getStory(story_gid, opts);
        return result;
    } catch (error) {
        console.error(`❌ Error fetching Story ${story_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch story from Asana");
    }
}

async function getStoriesByTask(task_gid) {
    const storiesApiInstance = initStoryApi();
    let opts = { 
        'opt_fields': "assignee,assignee.name,created_at,created_by,created_by.name,custom_field,custom_field.date_value,custom_field.date_value.date,custom_field.date_value.date_time,custom_field.display_value,custom_field.enabled,custom_field.enum_options,custom_field.enum_options.color,custom_field.enum_options.enabled,custom_field.enum_options.name,custom_field.enum_value,custom_field.enum_value.color,custom_field.enum_value.enabled,custom_field.enum_value.name,custom_field.id_prefix,custom_field.is_formula_field,custom_field.multi_enum_values,custom_field.multi_enum_values.color,custom_field.multi_enum_values.enabled,custom_field.multi_enum_values.name,custom_field.name,custom_field.number_value,custom_field.representation_type,custom_field.text_value,custom_field.type,dependency,dependency.created_by,dependency.name,dependency.resource_subtype,duplicate_of,duplicate_of.created_by,duplicate_of.name,duplicate_of.resource_subtype,duplicated_from,duplicated_from.created_by,duplicated_from.name,duplicated_from.resource_subtype,follower,follower.name,hearted,hearts,hearts.user,hearts.user.name,html_text,is_editable,is_edited,is_pinned,liked,likes,likes.user,likes.user.name,new_approval_status,new_date_value,new_dates,new_dates.due_at,new_dates.due_on,new_dates.start_on,new_enum_value,new_enum_value.color,new_enum_value.enabled,new_enum_value.name,new_multi_enum_values,new_multi_enum_values.color,new_multi_enum_values.enabled,new_multi_enum_values.name,new_name,new_number_value,new_people_value,new_people_value.name,new_resource_subtype,new_section,new_section.name,new_text_value,num_hearts,num_likes,old_approval_status,old_date_value,old_dates,old_dates.due_at,old_dates.due_on,old_dates.start_on,old_enum_value,old_enum_value.color,old_enum_value.enabled,old_enum_value.name,old_multi_enum_values,old_multi_enum_values.color,old_multi_enum_values.enabled,old_multi_enum_values.name,old_name,old_number_value,old_people_value,old_people_value.name,old_resource_subtype,old_section,old_section.name,old_text_value,previews,previews.fallback,previews.footer,previews.header,previews.header_link,previews.html_text,previews.text,previews.title,previews.title_link,project,project.name,resource_subtype,source,sticker_name,story,story.created_at,story.created_by,story.created_by.name,story.resource_subtype,story.text,tag,tag.name,target,target.created_by,target.name,target.resource_subtype,task,task.created_by,task.name,task.resource_subtype,text,type"
    };
    try{
        const result = await storiesApiInstance.getStoriesForTask(task_gid, opts);
        return result;
    } catch (error) {
        console.error(`❌ Error fetching Stories from task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch stories from Asana");
    }
}

async function createStoryOnTask(task_gid, data) {
    const storiesApiInstance = initStoryApi();
  
    const body = {data};
  
    const opts = {
      opt_fields: "gid,html_text,created_at,created_by.name"
    };
  
    try {
      const response = await storiesApiInstance.createStoryForTask(body, task_gid, opts);
      return response;
    } catch (error) {
      console.error(`❌ Error creating Comment on task ${task_gid}:`, error.response?.body || error.message);
      throw new Error("Failed to create comment in Asana");
    }
  }
async function commentAsana(type, task_gid) {
    const storiesApiInstance = initStoryApi();
  
}

async function getSubtaskByTask(task_gid) {
    const tasksApiInstance = initApi();
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,name,parent.name,projects,projects.name,resource_subtype"
    };
    try{
        const subtasks = await tasksApiInstance.getSubtasksForTask(task_gid, opts);
        return subtasks;
    } catch (error) {
        console.error(`❌ Error fetching Subtasks from task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch subtasks from Asana");
    }
}

async function createSubtasksOnTask(task_gid, data) {
    const tasksApiInstance = initApi();
    let body = {"data": data};
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,parent.name,projects,projects.name,resource_subtype"
    };
    try{
        const response = await tasksApiInstance.createSubtaskForTask(body, task_gid, opts);
        return response;
    } catch (error) {
        console.error(`❌ Error creating Subtask on task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to create Subtask in Asana");
    }
}

async function completeTaskById(task_gid) {
    const tasksApiInstance = initApi();
    let body = {"data": {
        "completed": "true"
    }}
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,parent.name,projects,projects.name,resource_subtype"
    };
    try{
        const response = await tasksApiInstance.updateTask(body, task_gid, opts)
        return response;
    } catch(error) {
        console.error(`❌ Error Completing task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to complete Task in Asana");
    }
}
module.exports = { findTasks, findAllTasks, updateTaskHtmlNotes, addLinkToTask, bewerberRoutine, getTaskById, getStoryById, getStoriesByTask, createStoryOnTask, getSubtaskByTask, createSubtasksOnTask, completeTaskById};
