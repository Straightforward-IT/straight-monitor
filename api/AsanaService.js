// AsanaService.js
const Asana = require("asana");
const axios = require("axios");
require("dotenv").config();

const { sendMail } = require("./EmailService");
const registry = require("./config/registry");

/* ------------------------------- Asana inits ------------------------------- */
function initTasksApi() {
  const client = Asana.ApiClient.instance;
  const token = client.authentications["token"];
  token.accessToken = process.env.ASANA_PAT;
  return new Asana.TasksApi();
}

function initStoriesApi() {
  const client = Asana.ApiClient.instance;
  const token = client.authentications["token"];
  token.accessToken = process.env.ASANA_PAT;
  return new Asana.StoriesApi();
}

/* --------------------------- Queue for html updates ------------------------ */
const updateQueue = [];
const maxConcurrentRequests = 15;
let activeRequests = 0;

function queueTaskUpdate(task_gid, newHtmlNotes) {
  updateQueue.push({ task_gid, newHtmlNotes });
}
setInterval(processQueue, 500);

async function processQueue() {
  if (activeRequests >= maxConcurrentRequests || updateQueue.length === 0) return;

  const { task_gid, newHtmlNotes } = updateQueue.shift();
  activeRequests++;
  try {
    await updateTask(task_gid, { html_notes: newHtmlNotes });
  } catch (error) {
    console.error(`❌ Failed to update task ${task_gid}:`, error.message);
    if (error.response?.status === 429) {
      console.warn(`⏳ Rate limit exceeded for ${task_gid}. Re-queuing.`);
      queueTaskUpdate(task_gid, newHtmlNotes);
      await new Promise((r) => setTimeout(r, 5000));
    }
  } finally {
    activeRequests--;
  }
}


/* --------------------------------- Utils ---------------------------------- */
function pickProjectId({ teamKey, upn }) {
  // 1) explicit teamKey
  if (teamKey) {
    const id = registry.getAsanaProjectId(teamKey);
    if (id) return id;
  }
  // 2) match by UPN from registry
  if (upn) {
    const team = registry
      .listTeams()
      .find((t) => (t.graph?.upn || "").toLowerCase() === String(upn).toLowerCase());
    if (team?.asana?.projectId) return team.asana.projectId;
  }
  // 3) single-project fallback (if exactly one is configured)
  const all = registry.getAsanaProjectIds();
  if (all.length === 1) return all[0];

  return null; // caller handles error
}

function _extractPersonName(email = {}) {
  // Parser liefert full_name unter email.meta?.full_name (wir reichen das aus applicantParser als meta mit)
  const metaName = email?.meta?.full_name && String(email.meta.full_name).trim();
  if (metaName) return metaName;

  // Fallback: aus dem Betreff "Vorname Nachname - S|L|?" den Namen ziehen
  const subj = String(email.subject || "").trim();
  const m = subj.match(/^(.*?)(?:\s*-\s*[SL?])?$/i);
  return (m && m[1] && m[1].trim()) || subj || "Unbekannt";
}

function buildEmailHtml({ subject, fromName, fromAddr, bodyText, receivedDateTime }) {
  const safeText =
    String(bodyText || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // don’t overdo formatting; just keep line-breaks readable:
      .replace(/\n/g, "<br>") || "(kein Inhalt)";

  const meta = [
    receivedDateTime ? `📥 <b>Eingang:</b> ${new Date(receivedDateTime).toLocaleString("de-DE")}` : "",
    fromName || fromAddr ? `👤 <b>Von:</b> ${fromName || fromAddr} &lt;${fromAddr || "unbekannt"}&gt;` : "",
  ].filter(Boolean).join("<br>");

  return `
  <body>
    <h2>${subject ? String(subject).replace(/</g,"&lt;").replace(/>/g,"&gt;") : "(kein Betreff)"}</h2>
    <div style="margin:6px 0 14px 0;font-size:12px;color:#555;">
      ${meta}
    </div>
    <div style="white-space:normal;line-height:1.4">${safeText}</div>
  </body>`;
}


/**
 * Fetch all tasks for a given project, handling pagination.
 * @param {Object} opts - The query parameters (must include project ID).
 * @returns {Array} - A list of all tasks.
 */
async function findAllTasks(opts) {
    const api = initTasksApi();
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

            const response = await api.getTasks(queryOpts);
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
    const api = initTasksApi();
    try {
        const result = await api.getTasks(opts);
        return result?.data || [];
    } catch (error) {
        console.error("❌ Error fetching tasks:", error.response?.body || error.message);
        throw new Error("Failed to fetch tasks from Asana");
    }
}

/**
 * Generic function to update any field of a task
 */
async function updateTask(task_gid, updateData, opts = {}) {
    const api = initTasksApi();

    try {
        // Validate input parameters
        if (!task_gid || !updateData || Object.keys(updateData).length === 0) {
            throw new Error("Task GID and a non-empty updateData object are required.");
        }

        console.log(`🔄 Updating task ${task_gid} with new data...`);

        // The Asana API expects the payload to be wrapped in a 'data' object.
        const body = {
            data: updateData
        };

        console.log("Request Body:", JSON.stringify(body, null, 2));
        
        const response = await api.updateTask(body, task_gid, opts);
        
        console.log(`✅ Task ${task_gid} updated successfully.`);
        return response;

    } catch (error) {
        // This generic function will not use the specific requeueing logic.
        // It will throw the error to let the caller decide how to handle retries.
        console.error(`❌ Failed to update task ${task_gid}:`, error.response?.data || error.message);
        throw error; // Re-throw the error to be handled by the calling function
    }
}




/**
 * Adds Bewerber erstellen link to a task if not already present
 */
async function addLinkToTask(taskOrGid) {
  // taskOrGid kann { gid, html_notes } oder nur "gid" sein
  const gid = typeof taskOrGid === "string" ? taskOrGid : taskOrGid?.gid;
  if (!gid) return;

  // 1) Aktuelle html_notes holen, falls nicht mitgegeben
  let currentHtml = (typeof taskOrGid === "object" && taskOrGid?.html_notes) || "";
  if (!currentHtml) {
    try {
      const t = await getTaskById(gid);
      currentHtml = t?.html_notes || "";
    } catch (e) {
      console.warn("⚠️ addLinkToTask: konnte html_notes nicht laden, verwende leer", e.message);
      currentHtml = "";
    }
  }

  // 2) Wenn Link schon vorhanden → nichts tun
  if (currentHtml.includes("Bewerber erstellen</a>")) return;

  // 3) Link-Header vor den existierenden Body setzen
  const header = `<h1><a href="https://straightmonitor.com/flip/benutzer-erstellen/${gid}">Bewerber erstellen</a></h1>\n`;

  // a) Falls es ein <body> gibt: direkt dahinter einfügen
  let updatedHtml;
  if (currentHtml.includes("<body>")) {
    updatedHtml = currentHtml.replace("<body>", `<body>${header}`);
  } else if (currentHtml.trim()) {
    // b) Es gibt Inhalt, aber keinen Body → umhüllen und Header voranstellen
    updatedHtml = `<body>${header}${currentHtml}</body>`;
  } else {
    // c) Komplett leer → minimaler Body mit Header
    updatedHtml = `<body>${header}</body>`;
  }

  queueTaskUpdate(gid, updatedHtml);
}


/**
 * Routine to check tasks and append the link if missing
 */
async function bewerberRoutine(teamKeys = null) {
  const project_ids = registry.getAsanaProjectIds(teamKeys);
  if (project_ids.length === 0) {
    console.warn("⚠️ bewerberRoutine: keine Asana-Projekt-IDs in registry gefunden.");
    return;
  }

  try {
    for (const id of project_ids) {
      const opts = {
        project: id,
        completed_since: "now",
        opt_fields: "gid,html_notes",
      };

      const tasks = await findTasks(opts);
      const tasksToUpdate = tasks.filter(
        (t) => !t.html_notes?.includes("Bewerber erstellen</a>")
      );

      tasksToUpdate.forEach(addLinkToTask);
      console.log(`✅ ${tasksToUpdate.length} tasks queued for project ${id}.`);
    }
  } catch (error) {
    console.error("❌ Error in Bewerber Routine:", error.message);
    await sendMail(
      "it@straightforward.email",
      "❌ Asana API Task Routine Failed",
      `
        <h3>Error in Bewerber Routine</h3>
        <p><strong>Error:</strong> ${error.message}</p>
        <pre>${error.stack}</pre>
      `
    );
  }
}
async function createTaskFromEmail(email, files = [], hint = {}) {
  const tasksApi = initTasksApi();

  // 0) Projektwahl
  const projectId = pickProjectId({ teamKey: hint.teamKey, upn: hint.upn });
  if (!projectId) {
    throw new Error(
      `Kein passendes Asana-Projekt gefunden (teamKey='${hint.teamKey || "-"}', upn='${hint.upn || "-"}').`
    );
  }

  // 0a) Person-Name für Duplicate-Suche (rein Name, ohne S/L)
  const personName = _extractPersonName(email);

  // 0b) Duplikate prüfen (auch abgeschlossene) – mit Personennamen
  let duplicateTask = null;
  try {
    duplicateTask = await findExistingTaskByName(projectId, personName);
    if (duplicateTask) {
      console.log(`🔎 Bestehender Person-Task gefunden: ${duplicateTask.gid} (${duplicateTask.name})`);
    }
  } catch (e) {
    console.warn("⚠️ Duplicate check (by name) failed:", e.message);
  }

  // 1) Task minimal anlegen (Name/Notes/Due)
  //    Name bleibt wie bisher (Parser-Titel), damit S/L im Titel sichtbar bleibt
  const name = email.subject || "(kein Betreff)";

  // Beschreibung (notes): NUR Telefon & E-Mail
  const contacts = [];
  const tel = email.meta?.telefon;
  const mail = email.meta?.email;

  if (tel) contacts.push(`Telefon: ${tel}`);
  if (mail) contacts.push(`E-Mail: ${mail}`);

  // Wenn Parser nichts liefern konnte: versuche Fallbacks aus bodyPreview
  if (!contacts.length && email.bodyPreview) {
    // Minimaler Fallback-Extractor (hält’s simpel)
    const em = (email.bodyPreview.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/) || [])[0];
    const ph = (email.bodyPreview.match(/(\+?\d[\d\s\/\-\(\)]{5,}\d)/) || [])[0];
    if (ph) contacts.push(`Telefon: ${ph}`);
    if (em) contacts.push(`E-Mail: ${em}`);
  }

  // Link auf bestehenden Task (wenn gefunden)
  // – in die Plain-Notes rein, ohne sonstige Meta-Anteile
  if (duplicateTask?.permalink_url) {
    contacts.push("");
    contacts.push(`🔗 Bestehender Task: ${duplicateTask.permalink_url}`);
  }

  const plainNotes = contacts.join("\n");

  let createdTask;
  try {
    const body = {
      data: {
        name,
        projects: [projectId],
        notes: plainNotes,                            // <- nur Tel/E-Mail (+ evtl. Link)
        ...(email.meta?.due_date ? { due_on: email.meta.due_date } : {}),
      },
    };
    const resp = await tasksApi.createTask(body, { opt_fields: "gid,name,permalink_url" });
    createdTask = resp?.data || resp;
    console.log(`🆕 Asana task created: ${createdTask?.gid} (${createdTask?.name})`);
  } catch (e) {
    console.error("❌ Asana task create failed:", e.response?.data || e.message);
    throw e;
  }

  // 2) Rich HTML-Notes (darfs weiterhin hübsch+voll sein)
  try {
    const contactBlock = contacts.filter(Boolean).join("\n"); // gleiche Contacts wie oben
    
    // Für Berlin: Kommentartext direkt in die Notes einbauen
    // Für andere Teams: Kommentartext bleibt separat für Story
    const isBerlin = hint.teamKey === "Berlin" || hint.teamKey === "berlin";
    const commentBlock = (email.bodyText && email.bodyText.trim()) || "";
    
    let combinedText;
    if (isBerlin) {
      // Bei Berlin: Kontaktformular-Informationen werden direkt in die Notes integriert
      combinedText = [contactBlock, commentBlock].filter(Boolean).join("\n\n");
    } else {
      // Bei anderen Teams: Nur Kontaktdaten in die Notes
      combinedText = contactBlock;
    }

    let html = buildEmailHtml({
      subject: email.subject,
      fromName: email.fromName,
      fromAddr: email.fromAddr,
      bodyText: combinedText,
      receivedDateTime: email.receivedDateTime,
      provider: hint.provider,
      teamKey: hint.teamKey,
    });

    // Duplikat-Hinweis auch im HTML schön sichtbar
    if (duplicateTask?.permalink_url) {
      const dupBlock = `
        <div style="margin-top:12px;padding:8px;background:#fff3cd;border:1px solid #ffeeba;border-radius:4px;">
          🔗 Bestehender Task:
          <a href="${duplicateTask.permalink_url}" target="_blank" rel="noopener">${duplicateTask.name}</a>
        </div>`;
      html = html.replace("</body>", `${dupBlock}</body>`);
    }

    queueTaskUpdate(createdTask.gid, html);
  } catch (e) {
    console.warn("⚠️ Failed to queue html_notes update:", e.message);
  }

  // 3) Parser-Kommentar als Story - nur für Non-Berlin Teams
  try {
    const isBerlin = hint.teamKey === "Berlin" || hint.teamKey === "berlin";
    
    if (!isBerlin) {
      // Für alle Teams außer Berlin: Kommentar als Story anhängen (wie gehabt)
      const comment = email.meta?.asana_comment || email.bodyText || "";
      if (comment && comment.trim()) {
        const safe = comment.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await createStoryOnTask(createdTask.gid, { html_text: `<body><pre>${safe}</pre></body>` });
      }
    }
    // Für Berlin: Keine Story erstellen, da Informationen bereits in den Notes stehen
  } catch (e) {
    console.warn("⚠️ createStoryOnTask failed:", e.message);
  }

  // 4) Attachments
  try {
    await uploadAttachmentsToTask(createdTask.gid, files);
  } catch (e) {
    console.error("❌ Attachment upload error:", e.response?.data || e.message);
  }

  // 5) Bewerber-Link oben einfügen
  try {
    await addLinkToTask(createdTask.gid);
  } catch (e) {
    console.warn("⚠️ addLinkToTask failed:", e.message);
  }

  return createdTask;
}


/**
 * Fetch a single task by its GID.
 * @param {string} task_gid - The task GID from Asana.
 * @returns {Object} - The task data from Asana.
 */
async function getTaskById(task_gid) {
    const api = initTasksApi();
    
    let opts = { 
        'opt_fields': "gid,name,assignee,assignee.name,completed,completed_at, completed_by, created_at,custom_fields,custom_fields.name,custom_fields.text_value,due_on,html_notes,memberships,memberships.project,memberships.project.name, memberships.section, memberships.section.gid, memberships.section.name, notes,permalink_url"
    };

    try {
        const result = await api.getTask(task_gid, opts);
        return result?.data || null;
    } catch (error) {
        console.error(`❌ Error fetching task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch task from Asana");
    }
}

async function getStoryById(story_gid) {
    const storiesApiInstance = initStoriesApi();
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
    const storiesApiInstance = initStoriesApi();
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
    const storiesApiInstance = initStoriesApi();
  
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

async function getSubtaskByTask(task_gid) {
    const api = initTasksApi();
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,name,parent.name,projects,projects.name,resource_subtype"
    };
    try{
        const subtasks = await api.getSubtasksForTask(task_gid, opts);
        return subtasks;
    } catch (error) {
        console.error(`❌ Error fetching Subtasks from task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to fetch subtasks from Asana");
    }
}

// --- Duplicate finder (by exact normalized name) ---
function _normalizeTitle(s = "") {
  return String(s)
    .replace(/\s*-\s*(S|L)\s*$/i, "")     // S/L-Suffix abwerfen
    .replace(/\s+/g, " ")                 // Mehrfachspaces
    .trim()
    .toLowerCase();
}

/**
 * Sucht in einem Projekt nach einem Task mit identischem (normalisiertem) Namen.
 * Bezieht auch abgeschlossene Tasks ein (completed_since=all).
 */
async function findExistingTaskByName(projectId, name, { maxPages = 50 } = {}) {
  const api = initTasksApi();
  if (!projectId || !name) return null;

  const target = _normalizeTitle(name);
  let offset = null;
  let page = 0;

  // „Alle“ Tasks → mit sehr altem Timestamp
  const COMPLETED_SINCE_ALL = "1970-01-01T00:00:00Z";

  try {
    do {
      const opts = {
        project: projectId,
        limit: 100,
        opt_fields: "gid,name,permalink_url,completed,modified_at",
        completed_since: COMPLETED_SINCE_ALL, // <<< Trick
        ...(offset ? { offset } : {}),
      };

      const resp = await api.getTasks(opts);
      const data = resp?.data || [];

      const match = data.find(t => _normalizeTitle(t.name) === target);
      if (match) return match;

      offset = resp?.next_page?.offset || null;
      page += 1;
    } while (offset && page < maxPages);
  } catch (e) {
    console.warn("⚠️ findExistingTaskByName failed:", e?.response?.data || e.message);
  }

  return null;
}



async function createSubtasksOnTask(task_gid, data) {
    const api = initTasksApi();
    let body = {"data": data};
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,parent.name,projects,projects.name,resource_subtype"
    };
    try{
        const response = await api.createSubtaskForTask(body, task_gid, opts);
        return response;
    } catch (error) {
        console.error(`❌ Error creating Subtask on task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to create Subtask in Asana");
    }
}

async function completeTaskById(task_gid) {
    const api = initTasksApi();
    let body = {"data": {
        "completed": "true"
    }}
    let opts = {
        'opt_fields': "approval_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by, html_notes,parent.name,projects,projects.name,resource_subtype, name, permalink_url"
    };
    try{
        const response = await api.updateTask(body, task_gid, opts)
        return response;
    } catch(error) {
        console.error(`❌ Error Completing task ${task_gid}:`, error.response?.body || error.message);
        throw new Error("Failed to complete Task in Asana");
    }
}


/* ------------------------- Attachment upload helper ------------------------ */
/**
 * Uses raw axios to hit:
 * POST https://app.asana.com/api/1.0/tasks/{task_gid}/attachments
 * multipart/form-data with `file`
 */
async function uploadAttachmentsToTask(task_gid, files = []) {async function createTaskFromEmail(email, files = [], hint = {}) {
  const tasksApi = initTasksApi();

  // 0) Projektwahl
  const projectId = pickProjectId({ teamKey: hint.teamKey, upn: hint.upn });
  if (!projectId) {
    throw new Error(
      `Kein passendes Asana-Projekt gefunden (teamKey='${hint.teamKey || "-"}', upn='${hint.upn || "-"}').`
    );
  }

  // 1) Task minimal anlegen (Name, Notes, Due Date)
  const name = email.subject || "(kein Betreff)"; // <- parsed.asana_title kommt hier rein
  const bodyLines = [];
  if (email.bodyPreview) bodyLines.push(email.bodyPreview); // <- parsed.asana_body (nur Tel/E-Mail)
  bodyLines.push(`Von: ${email.fromName || email.fromAddr || "unbekannt"} <${email.fromAddr || ""}>`);
  if (email.receivedDateTime) {
    bodyLines.push(`Eingang: ${new Date(email.receivedDateTime).toLocaleString("de-DE")}`);
  }
  if (hint.provider) {
    bodyLines.push(`Quelle: ${hint.provider}`);
  }
  const plainNotes = bodyLines.filter(Boolean).join("\n");

  let createdTask;
  try {
    const body = {
      data: {
        name,
        projects: [projectId],
        notes: plainNotes,
        // Fälligkeitsdatum aus Parser übernehmen (YYYY-MM-DD)
        ...(email.meta?.due_date ? { due_on: email.meta.due_date } : {}),
      },
    };
    const resp = await tasksApi.createTask(body, { opt_fields: "gid,name,permalink_url" });
    createdTask = resp?.data || resp;
    console.log(`🆕 Asana task created: ${createdTask?.gid} (${createdTask?.name})`);
  } catch (e) {
    console.error("❌ Asana task create failed:", e.response?.data || e.message);
    throw e;
  }

  // 2) Rich HTML-Notes setzen (Beschreibung hübsch)
  try {
    const html = buildEmailHtml({
      subject: email.subject,            // schon der Parser-Titel
      fromName: email.fromName,
      fromAddr: email.fromAddr,
      bodyText: email.bodyText || email.bodyPreview, // beim Kontaktformular: strukturierter Kommentar kommt separat
      receivedDateTime: email.receivedDateTime,
      provider: hint.provider,
      teamKey: hint.teamKey,
    });
    queueTaskUpdate(createdTask.gid, html);
  } catch (e) {
    console.warn("⚠️ Failed to queue html_notes update:", e.message);
  }

  // 3) Parser-Kommentar als erste Story anhängen (falls vorhanden)
  try {
    const comment = email.meta?.asana_comment || email.bodyText || "";
    if (comment && comment.trim()) {
      // Plaintext → in <pre> kapseln, damit Formatierung erhalten bleibt
      const safe = comment
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      await createStoryOnTask(createdTask.gid, {
        html_text: `<body><pre>${safe}</pre></body>`,
      });
    }
  } catch (e) {
    console.warn("⚠️ createStoryOnTask failed:", e.message);
  }

  // 4) Attachments hochladen
  try {
    await uploadAttachmentsToTask(createdTask.gid, files);
  } catch (e) {
    console.error("❌ Attachment upload error:", e.response?.data || e.message);
  }

  // 5) Bewerber-Link-Header ergänzen
  try {
    await addLinkToTask({ gid: createdTask.gid, html_notes: "<body></body>" });
  } catch (e) {
    console.warn("⚠️ addLinkToTask failed:", e.message);
  }

  // 6) (Debug/Logging) komplettes Raw-HTML an IT schicken
  try {
    if (email.bodyHtml) {
      await sendMail(
        "it@straightforward.email",
        `RAW Mail-HTML (${hint.teamKey || hint.upn || "unknown"}) – ${name}`,
        `<h3>Provider: ${hint.provider || "-"}</h3>
         <h4>UPN: ${hint.upn || "-"}</h4>
         <h4>Team: ${hint.teamKey || "-"}</h4>
         <pre style="white-space:pre-wrap;word-wrap:break-word;">${(
           email.bodyHtml || ""
         )
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")}</pre>`
      );
    }
  } catch (e) {
    console.warn("⚠️ sending RAW HTML to IT failed:", e.message);
  }

  return createdTask;
}
  const url = `https://app.asana.com/api/1.0/tasks/${task_gid}/attachments`;

  for (const f of files) {
    // normalize buffer
    let buf = null;
    if (f.arrayBuffer) {
      buf = Buffer.from(f.arrayBuffer);
    } else if (f.contentBytes) {
      buf = Buffer.from(f.contentBytes, "base64");
    } else if (f.content) {
      buf = Buffer.from(f.content, "base64");
    }

    if (!buf) {
      console.warn(`⚠️ Skip attachment (no data): ${f.name}`);
      continue;
    }

    const FormData = require("form-data");
    const form = new FormData();
    form.append("file", buf, {
      filename: f.name || "attachment.bin",
      contentType: f.contentType || "application/octet-stream",
      knownLength: buf.length,
    });

    try {
      await axios.post(url, form, {
        headers: {
          Authorization: `Bearer ${process.env.ASANA_PAT}`,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      console.log(`📎 Uploaded attachment → ${f.name || "(unnamed)"} to ${task_gid}`);
    } catch (e) {
      console.error(`❌ Upload failed for ${f.name || "(unnamed)"}:`, e.response?.data || e.message);
    }
  }
}

module.exports = {  // find/update
  findTasks,
  findAllTasks,
  updateTask,

  // Bewerber link + routine
  addLinkToTask,
  bewerberRoutine,

  // create task from email (+ attachments)
  createTaskFromEmail,

  // misc
  getTaskById,
  getStoryById,
  getStoriesByTask,
  getSubtaskByTask,
  createSubtasksOnTask,
  createStoryOnTask,
  completeTaskById,};
