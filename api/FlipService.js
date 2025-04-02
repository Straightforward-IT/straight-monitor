const stringSimilarity = require("string-similarity");
const mongoose = require("mongoose");
const { flipAxios } = require("./flipAxios");
const FlipUser = require("./models/Classes/FlipUser");
const FlipTask = require("./models/Classes/FlipTask");
const { Laufzettel, EventReport, EvaluierungMA } = require("./models/FlipDocs");
const Mitarbeiter = require("./models/Mitarbeiter");
const { sendMail } = require("./EmailService");
const { findTasks } = require("./AsanaService");
require("dotenv").config();

const apiUserGroup = "e9e8e278-08a9-4b0e-bdf6-681f8e26c43a";
const user_role = "53267279-ffb8-4cb9-aced-e5d92ed9be05";
async function flipUserRoutine() {
  let emailLogs = [];

  try {
    emailLogs.push("🔄 Running Flip API user refresh...");

    const allFlipUsers = await getFlipUsers({
      sort: "LAST_NAME_ASC",
      page_limit: 100,
      status: ["ACTIVE"],
    });

    if (!allFlipUsers || !Array.isArray(allFlipUsers)) {
      emailLogs.push(
        `❌ Flip API response is invalid: ${JSON.stringify(allFlipUsers)}`
      );
      throw new Error("Invalid response from Flip API");
    }

    emailLogs.push(
      `✅ Fetched ${allFlipUsers.length} Flip users. Processing...`
    );

    const activeFlipUserIds = new Set(
      allFlipUsers.filter((u) => u.status === "ACTIVE").map((u) => u.id)
    );

    for (const flipUserData of allFlipUsers) {
      if (flipUserData.primary_user_group?.id === apiUserGroup) continue;

      const flipUser = new FlipUser(flipUserData);

      if (
        !flipUser.email &&
        flipUser.benutzername &&
        !flipUser.benutzername.includes("@")
      ) {
        flipUser.email = flipUser.benutzername;
        await flipUser.update();
        emailLogs.push(
          `⚠️ FlipUser ${flipUser.id} had no email. Username set as email (${flipUser.email}).`
        );
      }

      let mitarbeiter = await Mitarbeiter.findOne({
        $or: [
          { flip_id: flipUser.id },
          { email: flipUser.email },
          { _id: flipUser.external_id },
        ],
      });

      if (!mitarbeiter) {
        mitarbeiter = await createMitarbeiterByFlip(flipUser);
        emailLogs.push(
          `✅ Created Mitarbeiter: ${mitarbeiter.vorname} ${mitarbeiter.nachname} (${mitarbeiter._id})`
        );
      } else {
        let changesMade = false;

        if (!mitarbeiter.isActive) {
          mitarbeiter.isActive = true;
          changesMade = true;
          emailLogs.push(
            `🟢 Mitarbeiter reactivated: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
          );
        }

        if (!mitarbeiter.flip_id || mitarbeiter.flip_id !== flipUser.id) {
          mitarbeiter.flip_id = flipUser.id;
          changesMade = true;
          emailLogs.push(
            `🟠 Mitarbeiter flip_id updated: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
          );
        }

        if (changesMade) await mitarbeiter.save();
      }

      if (!mitarbeiter._id.equals(flipUser.external_id)) {
        flipUser.setExternalId(mitarbeiter._id.toString());
        await flipUser.update();
        emailLogs.push(
          `🟠 Fixed external_id mismatch for ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
        );
      }

      const shouldBeActive = flipUser.status === "ACTIVE";
      if (mitarbeiter.isActive !== shouldBeActive) {
        mitarbeiter.isActive = shouldBeActive;
        await mitarbeiter.save();
        emailLogs.push(
          `🟡 Mitarbeiter ${mitarbeiter.vorname} ${mitarbeiter.nachname} active status synced (${shouldBeActive})`
        );
      }
    }

    const allMitarbeiter = await Mitarbeiter.find({
      flip_id: { $exists: true },
    });

    for (const mitarbeiter of allMitarbeiter) {
      if (!activeFlipUserIds.has(mitarbeiter.flip_id)) {
        if (mitarbeiter.isActive) {
          mitarbeiter.isActive = false;
          mitarbeiter.flip_id = null;
          await mitarbeiter.save();
          emailLogs.push(
            `🔴 Mitarbeiter deactivated: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
          );
        }
      } else if (!mitarbeiter.email) {
        const flipUser = allFlipUsers.find((u) => u.id === mitarbeiter.flip_id);
        if (flipUser?.email) {
          mitarbeiter.email = flipUser.email;
          await mitarbeiter.save();
          emailLogs.push(
            `✅ Email updated for Mitarbeiter ${mitarbeiter.vorname} ${mitarbeiter.nachname} (${flipUser.email})`
          );
        } else {
          emailLogs.push(
            `⚠️ No email found for Mitarbeiter ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
          );
        }
      }
    }

    emailLogs.push("✅ Flip user refresh completed successfully.");

    await sendMail(
      "it@straightforward.email",
      "Flip User Refresh Completed",
      emailLogs.join("<br>")
    );

    return allFlipUsers;
  } catch (error) {
    emailLogs.push(
      `❌ Critical error during Flip user refresh: ${error.message}`
    );

    await sendMail(
      "it@straightforward.email",
      "⚠️ Critical Error in Flip User Refresh",
      emailLogs.join("<br>")
    );

    throw error;
  }
}
async function asanaTransferRoutine(section) {
  let tasksNotFound = [];
  let emailLogs = [];

  try {
    const opts = {
      section,
      completed_since: new Date().toISOString(),
      opt_fields: "gid, name, html_notes, memberships.section, memberships.section.name, external.gid",
    };

    const tasks = await findTasks(opts);

    if (!tasks) throw new Error("No tasks fetched from Asana.");

    for (const task of tasks) {
      let mitarbeiter = await Mitarbeiter.findOne({ asana_id: task.gid });

      if (!mitarbeiter) {
        const containedEmails = parseEmails(task);

        if (containedEmails.length === 0) {
          tasksNotFound.push({ task, reason: "No email found in task." });
          continue;
        }

        for (const email of containedEmails) {
          const matchingMitarbeiter = await Mitarbeiter.find({ email });

          if (matchingMitarbeiter.length === 1) {
            const foundMitarbeiter = matchingMitarbeiter[0];

            if (!foundMitarbeiter.asana_id) {
              foundMitarbeiter.asana_id = task.gid;
              await foundMitarbeiter.save();
              emailLogs.push(`✅ Updated Mitarbeiter: ${foundMitarbeiter.vorname} ${foundMitarbeiter.nachname} (Email: ${email}) with Asana ID: ${task.gid}`);
            } else {
              emailLogs.push(`⚠️ Mitarbeiter already has Asana ID: ${foundMitarbeiter.vorname} ${foundMitarbeiter.nachname} (Email: ${email}) - Skipped updating.`);
            }
          } else if (matchingMitarbeiter.length > 1) {
            tasksNotFound.push({ task, reason: `Multiple Mitarbeiter found with email ${email}.` });
          } else {
            tasksNotFound.push({ task, reason: `No Mitarbeiter found with email ${email}.` });
          }
        }
      }
    }

    if (tasksNotFound.length > 0) {
      emailLogs.push(`<h3>Tasks with Issues:</h3>`);
      tasksNotFound.forEach(({ task, reason }) => {
        emailLogs.push(`❌ Task ${task.gid} (${task.name}) - ${reason}`);
      });

      await sendMail(
        "it@straightforward.email",
        "⚠️ Asana Transfer Routine - Issues Detected",
        emailLogs.join("<br>")
      );
    } else {
      emailLogs.push("✅ No issues detected during Asana transfer routine.");
      await sendMail(
        "it@straightforward.email",
        "✅ Asana Transfer Routine Completed Successfully",
        emailLogs.join("<br>")
      );
    }
  } catch (err) {
    console.error("Critical error in asanaTransferRoutine:", err);
    emailLogs.push(`❌ Critical error: ${err.message}`);
    await sendMail(
      "it@straightforward.email",
      "❌ Critical Error in Asana Transfer Routine",
      emailLogs.join("<br>")
    );
  }
}

// Helper function to parse emails from task.html_notes
function parseEmails(task) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = task.html_notes?.match(emailRegex) || [];
  return matches;
}


async function createMitarbeiterByFlip(flipUser) {
  try {
    const mitarbeiterData = flipUser.toMitarbeiter();
    const newMitarbeiter = new Mitarbeiter(mitarbeiterData);
    await newMitarbeiter.save();
    console.log(
      `✅ Created new Mitarbeiter: ${flipUser.vorname} ${flipUser.nachname}`
    );
    return newMitarbeiter;
  } catch (error) {
    console.error("❌ Error creating Mitarbeiter:", error.message);
    throw new Error("Failed to create Mitarbeiter");
  }
}

async function createMitarbeiterByAsana(asanaKarte) {}

async function getFlipUsers(initialParams = {}) {
  let allUsers = [];
  let currentPage = 1;
  let totalPages = 1; // Default assumption, updated dynamically

  try {
    do {
      // Ensure params include the correct page number
      const params = {
        ...initialParams,
        page_number: currentPage,
        page_limit: 100,
      };

      const response = await flipAxios.get("/api/admin/users/v4/users", {
        params,
      });

      if (response.data && response.data.users) {
        allUsers.push(...response.data.users);
      }

      // Update pagination details
      const pagination = response.data.pagination;
      if (pagination) {
        totalPages = pagination.total_pages; // Total number of pages from response
        currentPage++; // Move to the next page
      } else {
        break; // No pagination info, exit loop
      }
    } while (currentPage <= totalPages);

    return allUsers;
  } catch (error) {
    console.error(
      "❌ Error fetching Flip users:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch all Flip users");
  }
}

async function getFlipUserGroups(params = {}) {
  /**
 * Query Params
 * search_term (string) - A term that needs to match in the user group name, description or external id.
 * sort (string[]) - Possible Enum Values
 * GROUP_NAME_ASC GROUP_NAME_DESC STATUS_ASC STATUS_DESC UPDATED_AT_ASC UPDATED_AT_DESC CREATED_AT_ASC CREATED_AT_DESC
  Achtung: Page Limit 25
*/

  try {
    const response = await flipAxios.get("/api/admin/users/v4/user-groups", {
      params,
    });
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error fetching Flip user-groups:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch Flip user groups");
  }
}
async function getFlipUserGroupAssignments(params = {}) {
  try {
    if (!params.group_id) throw new Error("group_id is required");
    const response = await flipAxios.get(
      `/api/admin/users/v4/user-groups/${params.group_id}/assignments`
    );
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error fetching Flip user group assignments",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch Flip User Group Assignments");
  }
}

async function assignFlipUserGroups(req) {
  try {
    console.log("🚀 Assigning user to user groups. Raw data:", req.body.items);

    // ✅ Ensure `items` is structured correctly
    const items =
      req.body.items
        ?.filter((item) => item.user_group_id) // Remove any invalid entries
        .map((item) => ({
          group_id: item.user_group_id, // ✅ Correct key name
          body: {
            role_id: user_role, // ✅ Fixed role ID
            user_id: item.user_id, // ✅ Ensure `user_id` is included
          },
        })) || [];

    if (items.length === 0) {
      console.log("🚨 No valid user groups to assign.");
      return;
    }

    console.log(
      "📤 Final formatted request payload:",
      JSON.stringify({ items }, null, 2)
    );

    const response = await flipAxios.post(
      "/api/admin/users/v4/user-groups/assignments/batch",
      { items }
    );

    console.log("✅ Successfully assigned user groups:", response.data?.items);

    // Check if response contains an error (status 400)
    if (response.data?.items?.some((item) => item.status === 400)) {
      console.error(
        "❌ One or more user group assignments failed:",
        response.data
      );

      // Prepare the error message for email
      const errorMessage = `
        <h2>❌ Error Assigning Users to User Groups</h2>
        <p>Some user group assignments failed with status 400.</p>
        <pre>${JSON.stringify(response.data, null, 2)}</pre>
      `;

      // Send an email notification
      await sendMail(
        "it@straightforward.email",
        "User Group Assignment Failed",
        errorMessage
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "❌ Error assigning Users to User Groups:",
      error.response ? error.response.data : error.message
    );

    const errorDetails = error.response
      ? JSON.stringify(error.response.data, null, 2)
      : error.message;

    // Prepare email content
    const errorMessage = `
      <h2>❌ Critical Error Assigning Users to User Groups</h2>
      <p>An unexpected error occurred while assigning user groups.</p>
      <pre>${errorDetails}</pre>
    `;

    // Send an email notification about the critical failure
    await sendMail(
      "it@straightforward.email",
      "Critical Error: User Group Assignment",
      errorMessage
    );

    throw new Error(errorDetails);
  }
}

const findFlipUserByName = async (fullName) => {
  const users = await FlipUser.find();

  // Normalize the input name for comparison
  const normalizedInput = fullName.toLowerCase().replace(/\s+/g, "");

  // Create arrays of normalized user names
  const normalizedUsers = users.map((user) => ({
    id: user._id,
    fullName: `${user.vorname} ${user.nachname}`
      .toLowerCase()
      .replace(/\s+/g, ""),
    vorname: user.vorname.toLowerCase(),
    nachname: user.nachname.toLowerCase(),
  }));

  const inputParts = fullName.toLowerCase().split(/\s+/);
  const inputLastName = inputParts[inputParts.length - 1];
  const inputFirstNames = inputParts.slice(0, -1);

  // Step 1: Exact match check (ignoring whitespace differences)
  const exactMatch = normalizedUsers.find(
    (user) => user.fullName === normalizedInput
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  // Step 2: Match by last name and any first name
  const lastNameMatch = normalizedUsers.find((user) => {
    return (
      user.nachname === inputLastName &&
      inputFirstNames.some((firstNamePart) =>
        user.vorname.includes(firstNamePart)
      )
    );
  });
  if (lastNameMatch) {
    return lastNameMatch.id;
  }

  // Step 3: Fallback to string similarity
  const userNames = normalizedUsers.map((user) => user.fullName);
  const matches = stringSimilarity.findBestMatch(normalizedInput, userNames);

  if (matches.bestMatch.rating > 0.8) {
    const matchedUser = normalizedUsers[matches.bestMatchIndex];
    return matchedUser.id;
  }

  // Step 4: No match found
  return null;
};
const findFlipUserById = async (id) => {
  const response = await flipAxios.get(`/api/admin/users/v4/users/${id}`);
  return response.data;
};

const findMitarbeiterByName = async (fullName) => {
  const users = await Mitarbeiter.find();
  const normalizedInput = fullName.toLowerCase().replace(/\s+/g, "");

  const normalizedUsers = users.map((user) => ({
    id: user._id,
    fullName: `${user.vorname} ${user.nachname}`
      .toLowerCase()
      .replace(/\s+/g, ""),
    vorname: user.vorname.toLowerCase(),
    nachname: user.nachname.toLowerCase(),
  }));

  const inputParts = fullName.toLowerCase().split(/\s+/);
  const inputLastName = inputParts[inputParts.length - 1];
  const inputFirstNames = inputParts.slice(0, -1);

  // Step 1: Exact match check (ignoring whitespace differences)
  const exactMatch = normalizedUsers.find(
    (user) => user.fullName === normalizedInput
  );
  if (exactMatch) {
    return exactMatch.id;
  }

  // Step 2: Match by last name and any first name
  const lastNameMatch = normalizedUsers.find((user) => {
    return (
      user.nachname === inputLastName &&
      inputFirstNames.some((firstNamePart) =>
        user.vorname.includes(firstNamePart)
      )
    );
  });
  if (lastNameMatch) {
    return lastNameMatch.id;
  }

  // Step 3: Fallback to string similarity
  const userNames = normalizedUsers.map((user) => user.fullName);
  const matches = stringSimilarity.findBestMatch(normalizedInput, userNames);

  if (matches.bestMatch.rating > 0.8) {
    const matchedUser = normalizedUsers[matches.bestMatchIndex];
    return matchedUser.id;
  }

  // Step 4: No match found
  return null;
};

const assignFields = async (documentId, updates, callback) => {
  try {
    const models = [Laufzettel, EventReport, EvaluierungMA];
    let documentFound = null;

    // Find the document in one of the models using `findOne()` (so pre-hooks run)
    for (const model of models) {
      documentFound = await model.findOne({ _id: documentId });
      if (documentFound) break;
    }

    if (!documentFound) {
      throw new Error("Document not found in any model");
    }

    // Apply updates to the document
    Object.assign(documentFound, updates);

    // Update the "assigned" field based on the type of document
    if (documentFound instanceof EventReport) {
      documentFound.assigned = !!documentFound.teamleiter;
    } else {
      documentFound.assigned =
        !!documentFound.teamleiter && !!documentFound.mitarbeiter;
    }

    await documentFound.save();

    // If updates include mitarbeiter, update their document references
    if (updates.mitarbeiter) {
      const mitarbeiter = await Mitarbeiter.findById(updates.mitarbeiter);
      if (mitarbeiter) {
        if (documentFound instanceof Laufzettel) {
          mitarbeiter.laufzettel_submitted.push(documentFound._id);
        } else if (documentFound instanceof EvaluierungMA) {
          mitarbeiter.evaluierungen_received.push(documentFound._id);
        }

        await mitarbeiter.save();
      }
    }

    // If updates include teamleiter, update their document references
    if (updates.teamleiter) {
      const teamleiter = await Mitarbeiter.findById(updates.teamleiter);
      if (teamleiter) {
        if (documentFound instanceof Laufzettel) {
          teamleiter.laufzettel_received.push(documentFound._id);
        } else if (documentFound instanceof EventReport) {
          teamleiter.eventreports.push(documentFound._id);
        } else if (documentFound instanceof EvaluierungMA) {
          teamleiter.evaluierungen_submitted.push(documentFound._id);
        }

        await teamleiter.save();
      }
    }

    if (callback) {
      await callback(documentFound, updates);
    }

    return documentFound;
  } catch (error) {
    throw new Error(`Error assigning fields: ${error.message}`);
  }
};

const assignTeamleiter = async (documentId, teamleiterId) => {
  return assignFields(
    documentId,
    { teamleiter: teamleiterId },
    async (document) => {
      if (document instanceof Laufzettel) {
        await document.populate("mitarbeiter teamleiter");

        const teamleiter = document.teamleiter;
        const mitarbeiter = document.mitarbeiter;

        if (!teamleiter || !mitarbeiter) {
          console.warn(
            `⚠ Missing required fields in Laufzettel: ${document._id}`
          );
          return;
        }

        try {
          const authToken = await getFlipAuthToken(); // 🔥 Use cached or fresh token

          await assignFlipTask({
            body: {
              external_id: document._id.toString(),
              title: `Laufzettel erhalten: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
              recipients: [
                {
                  id: teamleiter.flip_id,
                  type: "USER",
                },
              ],
              description: `Du wurdest als Teamleiter für den Laufzettel von ${mitarbeiter.vorname} ${mitarbeiter.nachname} zugewiesen.`,
            },
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            query: {},
          });

          console.log(`✅ Flip task assigned for Laufzettel: ${document._id}`);
        } catch (error) {
          console.error(`❌ Error assigning Flip task: ${error.message}`);
        }
      }
    }
  );
};
const assignMitarbeiter = async (documentId, mitarbeiterId) => {
  return assignFields(documentId, { mitarbeiter: mitarbeiterId });
};

async function assignFlipTask(req) {
  try {
    const { external_id, title, recipients, description } = req.body;
    if (!recipients || !Array.isArray(recipients)) {
      throw new Error(
        "Invalid recipients: Must be an array with at least one recipient."
      );
    }

    const newTask = new FlipTask({
      title,
      external_id,
      body: { html: description },
      recipients,
    });
    console.log(newTask);

    const existingTasks = await newTask.find();

    if (existingTasks.length > 0) {
      console.log(
        "⚠️ Task with external_id already exists. Skipping creation."
      );
      if (existingTasks.length === 1) {
        console.log("Updating existing task");
        let task = new FlipTask(existingTasks[0]); // Ensure it's an instance
        task.title = newTask.title;
        task.body = newTask.body;
        task.recipients = newTask.recipients;
        console.log(`Task id: ${task.id}`);
        await task.update();
        return task.toSimplifiedObject();
      }
      return existingTasks[0].toSimplifiedObject();
    }

    const createdTask = await newTask.create();

    console.log(
      "✅ Flip Task Assigned Successfully:",
      createdTask.toSimplifiedObject()
    );

    return createdTask.toSimplifiedObject();
  } catch (error) {
    console.error(
      "❌ Error assigning Flip Task:",
      error.response ? error.response.data : error.message
    );
    throw new Error(
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

module.exports = {
  flipUserRoutine,
  asanaTransferRoutine,
  getFlipUsers,
  getFlipUserGroups,
  getFlipUserGroupAssignments,
  findFlipUserByName,
  findFlipUserById,
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignFlipTask,
  assignFlipUserGroups,
};
