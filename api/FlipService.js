const stringSimilarity = require("string-similarity");
const mongoose = require("mongoose");
const { flipAxios, getFlipAuthToken } = require("./flipAxios");
const FlipUser = require("./models/Classes/FlipUser");
const FlipTask = require("./models/Classes/FlipTask");
const {
  Laufzettel,
  EventReport,
  EvaluierungMA,
  VerlosungEintrag,
} = require("./models/Classes/FlipDocs");
const Mitarbeiter = require("./models/Mitarbeiter");
const { sendMail } = require("./EmailService");
const logger = require("./utils/logger");
const {
  findTasks,
  findAllTasks,
  addLinkToTask,
  bewerberRoutine,
  getTaskById,
  getStoryById,
  getStoriesByTask,
  createStoryOnTask,
  getSubtaskByTask,
  createSubtasksOnTask,
  completeTaskById,
} = require("./AsanaService");
require("dotenv").config();

const apiUserGroup = "e9e8e278-08a9-4b0e-bdf6-681f8e26c43a";
const user_role = "53267279-ffb8-4cb9-aced-e5d92ed9be05";
async function flipUserRoutine() {
  let emailLogs = [];
  let invalidLocations = [];
  let invalidDepartments = [];

  try {
    emailLogs.push("🔄 Running Flip API user refresh...");

    const allFlipUsers = await getFlipUsers({
      sort: "LAST_NAME_ASC",
      page_limit: 100,
      status: ["ACTIVE", "PENDING_DELETION"],
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
    
    const validLocations = ["Hamburg", "Köln", "Berlin"];
    const validDepartmentParts = ["Service", "Logistik", "Office"];

    for (const flipUserData of allFlipUsers) {
      if (flipUserData.primary_user_group?.id === apiUserGroup) continue;

      const flipUser = new FlipUser(flipUserData);
      
      // Check location attribute
      const location = flipUser.profile?.location;
      if (location && !validLocations.includes(location)) {
        const correctedLocation = validLocations.find(
          (loc) => loc.toLowerCase() === location.toLowerCase()
        );

        if (correctedLocation) {
          try {
            // Update local object
            if (!flipUser.profile) flipUser.profile = {};
            flipUser.profile.location = correctedLocation;

            // Call update method
            await flipUser.update();

            emailLogs.push(
              `✅ Fixed location for ${flipUser.vorname} ${flipUser.nachname}: "${location}" -> "${correctedLocation}"`
            );
          } catch (err) {
            emailLogs.push(
              `❌ Failed to fix location for ${flipUser.vorname} ${flipUser.nachname}: ${err.message}`
            );
            // Still add to invalid because it failed to update
            invalidLocations.push({
              name: `${flipUser.vorname} ${flipUser.nachname}`,
              email: flipUser.email,
              location: location,
            });
          }
        } else {
          invalidLocations.push({
            name: `${flipUser.vorname} ${flipUser.nachname}`,
            email: flipUser.email,
            location: location,
          });
        }
      }
      
      // Check department attribute - allow combinations separated by " / "
      const department = flipUser.profile?.department;
      if (department) {
        const departmentParts = department.split('/').map(part => part.trim());
        const allPartsValid = departmentParts.every(part => validDepartmentParts.includes(part));
        
        if (!allPartsValid) {
          invalidDepartments.push({
            name: `${flipUser.vorname} ${flipUser.nachname}`,
            email: flipUser.email,
            department: department
          });
        }
      }

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
        $or: [{ flip_id: flipUser.id }, { email: flipUser.email }],
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

      const shouldBeActive = (flipUser.status === "ACTIVE" || flipUser.status === "PENDING_DELETION");
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

          // 🟡 Asana Task deaktivieren & response loggen
          try {
            const response = await completeTaskById(mitarbeiter.asana_id);
            const task = response?.data || response;
            emailLogs.push(
              `🔴 Mitarbeiter deaktiviert: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`
            );
            emailLogs.push(
              `📄 Asana Task "${task.name}" als erledigt markiert.`
            );
            emailLogs.push(`🔗 ${task.permalink_url}`);
          } catch (err) {
            emailLogs.push(
              `❌ Fehler beim Deaktivieren der Asana-Task von ${mitarbeiter.vorname}: ${err.message}`
            );
          }

          await mitarbeiter.save();
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
    
    // Add invalid locations to email if any found
    if (invalidLocations.length > 0) {
      emailLogs.push("<br><br><strong>⚠️ Ungültige Location-Attribute gefunden:</strong>");
      invalidLocations.forEach(user => {
        emailLogs.push(`🔴 ${user.name} (${user.email}): <strong>${user.location}</strong>`);
      });
    }
    
    // Add invalid departments to email if any found
    if (invalidDepartments.length > 0) {
      emailLogs.push("<br><br><strong>⚠️ Ungültige Department-Attribute gefunden:</strong>");
      invalidDepartments.forEach(user => {
        emailLogs.push(`🔴 ${user.name} (${user.email}): <strong>${user.department}</strong>`);
      });
    }

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
async function asanaTransferRoutine(section, currentLocation) {
  let tasksNotFound = [];
  let emailLogs = [];
  try {
    const opts = {
      section,
      completed_since: new Date().toISOString(),
      opt_fields:
        "gid, name, html_notes, memberships.section, memberships.section.name, external.gid",
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

        let matched = false;

        for (const email of containedEmails) {
          const matchingMitarbeiter = await Mitarbeiter.find({ email });

          if (matchingMitarbeiter.length === 1) {
            const foundMitarbeiter = matchingMitarbeiter[0];

            // Update Asana ID if missing
            if (!foundMitarbeiter.asana_id) {
              foundMitarbeiter.asana_id = task.gid;
              await foundMitarbeiter.save();

              emailLogs.push(
                `✅ Updated Mitarbeiter: ${foundMitarbeiter.vorname} ${foundMitarbeiter.nachname} (Email: ${email}) with Asana ID: ${task.gid}`
              );
            } else {
              emailLogs.push(
                `⚠️ Mitarbeiter already has Asana ID: ${foundMitarbeiter.vorname} ${foundMitarbeiter.nachname} || In Mitarbeiter: ${foundMitarbeiter.asana_id}. In Asana: ${task.gid}. (Email: ${email}) - Skipped updating.`
              );
            }

            matched = true;
            break; // ✅ Stop checking other emails once one is matched
          } else if (matchingMitarbeiter.length > 1) {
            tasksNotFound.push({
              task,
              reason: `Multiple Mitarbeiter found with email ${email}.`,
            });
          } else {
            // Only push to not found list if this was the last email
            if (
              !matched &&
              email === containedEmails[containedEmails.length - 1]
            ) {
              tasksNotFound.push({
                task,
                reason: `No Mitarbeiter found with email ${email}.`,
              });
            }
          }
        }
      } else {
        if (!mitarbeiter.isActive) {
          emailLogs.push(
            `🟡 Hinweis: Mitarbeiter ${mitarbeiter.vorname} ${mitarbeiter.nachname} ist derzeit *inaktiv*.`
          );
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
        `⚠️ Asana Transfer Routine (${currentLocation}) - Issues Detected `,
        emailLogs.join("<br>")
      );
    } else {
      emailLogs.push("✅ No issues detected during Asana transfer routine.");
      await sendMail(
        "it@straightforward.email",
        `✅ Asana Transfer Routine (${currentLocation}) Completed Successfully`,
        emailLogs.join("<br>")
      );
    }
  } catch (err) {
    console.error(
      `Critical error in (${currentLocation}) asanaTransferRoutine:`,
      err
    );
    emailLogs.push(`❌ Critical error: ${err.message}`);
    await sendMail(
      "it@straightforward.email",
      `❌ Critical Error in Asana Transfer Routine (${currentLocation})`,
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

async function getFlipUsers(initialParams = {}) {
  let allUsers = [];
  let currentPage = 1;
  let totalPages = 1;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    do {
      // Ensure params include the correct page number
      const params = {
        ...initialParams,
        page_number: currentPage,
        page_limit: 100,
      };

      try {
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
      } catch (reqError) {
        if (reqError.response?.status === 429) {
          // If rate limited, wait longer and retry current page
          console.warn(`⏳ Rate limited (429). Waiting 2s before retrying page ${currentPage}...`);
          await sleep(2000);
          continue; // Retry the same page
        }
        throw reqError;
      }

      // Small delay between successful requests to prevent 429
      await sleep(200);

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

// FlipService.js
async function getFlipProfilePicture(userId) {
  console.log(`🔍 Attempting to fetch profile picture for Flip user: ${userId}`);
  
  try {
    // 1) Direkter Avatar-Endpunkt pro User (wenn Flip das anbietet)
    console.log(`📡 Trying direct avatar endpoint for user: ${userId}`);
    const direct = await flipAxios.get(`/api/admin/users/v4/users/${userId}/avatar`, {
      responseType: 'arraybuffer'
    });
    
    console.log(`✅ Direct avatar success for ${userId}, size: ${direct.data?.length || 0} bytes`);
    return {
      data: direct.data,
      contentType: direct.headers['content-type'] || 'image/jpeg',
    };
  } catch (err1) {
    const status = err1.response?.status;
    console.log(`⚠️ Direct avatar failed for ${userId}: HTTP ${status}`);
    
    if (status && status !== 404) {
      console.error('❌ Avatar (direct) failed with non-404:', status, err1.response?.data?.toString?.()?.substring(0, 200) || err1.message);
      return null; // Nicht werfen, sondern null zurückgeben
    }
    // 404 → weiter mit Weg 2
  }

  try {
    // 2) User lesen → Media-ID ermitteln → Media holen
    console.log(`📡 Trying media-based avatar for user: ${userId}`);
    const userResp = await flipAxios.get(`/api/admin/users/v4/users/${userId}`);
    const u = userResp.data || {};

    // möglichst robust alle bekannten Varianten prüfen
    const mediaId =
      u.avatar_media_id ||
      u.profile_image_media_id ||
      u.profile_picture_id ||
      u?.avatar?.id ||
      u?.profile_image?.id ||
      u?.profile_picture?.id;

    if (!mediaId) {
      // kein Bild gesetzt
      console.log(`ℹ️ No media ID found for user ${userId}`);
      return null;
    }

    console.log(`📡 Fetching media ${mediaId} for user ${userId}`);
    const mediaResp = await flipAxios.get(`/media/avatars/${mediaId}`, {
      responseType: 'arraybuffer'
    });

    console.log(`✅ Media avatar success for ${userId}, size: ${mediaResp.data?.length || 0} bytes`);
    return {
      data: mediaResp.data,
      contentType: mediaResp.headers['content-type'] || 'image/jpeg',
    };
  } catch (err2) {
    const dbg = err2.response?.data?.toString?.()?.substring(0, 200) || err2.message;
    console.error(`❌ Error fetching Flip profile picture for ${userId}:`, dbg);
    return null; // Statt Exception null zurückgeben
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
  console.log(`🔍 Searching Flip user by name: "${fullName}"`);

  if (!fullName || typeof fullName !== "string") {
    console.warn("⚠️ Invalid fullName provided:", fullName);
    return null;
  }

  let users;
  try {
    users = await getFlipUsers();
    console.log(`✅ Received ${users.length} users from Flip API.`);
  } catch (error) {
    console.error("❌ Error fetching users from Flip API:", error);
    throw error;
  }

  if (!Array.isArray(users) || users.length === 0) {
    console.warn("⚠️ No users received from Flip API.");
    return null;
  }

  const normalizedInput = fullName.toLowerCase().trim();

  const normalizedUsers = users
    .filter((user) => user.first_name && user.last_name)
    .map((user) => ({
      id: user.id,
      fullName: `${user.first_name} ${user.last_name}`.toLowerCase().trim(),
      vorname: user.first_name.toLowerCase().trim(),
      nachname: user.last_name.toLowerCase().trim(),
    }));

  console.log(`✅ Normalized ${normalizedUsers.length} users for matching.`);

  const inputParts = normalizedInput.split(/\s+/);
  const inputLastName = inputParts[inputParts.length - 1];
  const inputFirstNames = inputParts.slice(0, -1).join(" ");

  // Exact match
  const exactMatch = normalizedUsers.find(
    (user) => user.fullName.replace(/\s+/g, "") === normalizedInput.replace(/\s+/g, "")
  );
  if (exactMatch) {
    console.log(`✅ Exact match found: ${exactMatch.fullName}`);
    return exactMatch.id;
  }

  // Match by last name + first name parts
  const lastNameMatch = normalizedUsers.find(
    (user) => user.nachname === inputLastName && user.vorname.includes(inputFirstNames)
  );
  if (lastNameMatch) {
    console.log(`✅ Last name & partial first name match: ${lastNameMatch.fullName}`);
    return lastNameMatch.id;
  }

  // String similarity fallback
  const userNames = normalizedUsers.map((user) => user.fullName);

  if (userNames.length === 0) {
    console.warn("⚠️ No valid user names to compare.");
    return null;
  }

  const matches = stringSimilarity.findBestMatch(normalizedInput, userNames);
  console.log(`🔬 Best string similarity match:`, matches.bestMatch);

  if (matches.bestMatch.rating > 0.8) {
    const matchedUser = normalizedUsers[matches.bestMatchIndex];
    console.log(`✅ Similarity match found: ${matchedUser.fullName} (Rating: ${matches.bestMatch.rating})`);
    return matchedUser.id;
  }

  console.warn(`⚠️ No suitable match found for "${fullName}"`);
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
    fullName: `${user.vorname || ""} ${user.nachname || ""}`
      .toLowerCase()
      .replace(/\s+/g, ""),
    vorname: (user.vorname || "").toLowerCase(),
    nachname: (user.nachname || "").toLowerCase(),
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
    const models = [Laufzettel, EventReport, EvaluierungMA, VerlosungEintrag];
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
    } else if (documentFound instanceof VerlosungEintrag) {
      documentFound.assigned = !!documentFound.mitarbeiter;
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
        } else if (documentFound instanceof VerlosungEintrag) {
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
        } else if (documentFound instanceof VerlosungEintrag) {
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
  let createdTask = null;

  await assignFields(
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
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // +3 Tage

        const formattedDueDate = dueDate.toISOString().split("T")[0]; // "yyyy-mm-dd"

        try {
          const task = await assignFlipTask({
            body: {
              external_id: document._id.toString(),
              title: `Laufzettel erhalten: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
              recipients: [{ id: teamleiter.flip_id, type: "USER" }],
              due_at: {
                date: formattedDueDate,
                due_at_type: "DATE",
              },
              description: `
Du wurdest als Teamleitung auf einem Laufzettel angegeben.<br><br>
Bitte fülle eine 
<a href="https://flipcms.de/integration/flipcms/hpstraightforward/evaluierung-ma/?wpf176_20_first=${encodeURIComponent(
                mitarbeiter.vorname
              )}&wpf176_20_last=${encodeURIComponent(
                mitarbeiter.nachname
              )}&wpf176_23=${document._id.toString()}" 
target="_self" rel="noopener noreferrer">Evaluierung</a> 
für ${mitarbeiter.vorname} aus.`,
            },
          });

          createdTask = task;
        } catch (error) {
          console.error(`❌ Error assigning Flip task: ${error.message}`);
        }
      }
    }
  );

  return createdTask; // ✅ Now you get the FlipTask from assignTeamleiter
};

const assignMitarbeiter = async (documentId, mitarbeiterId) => {
  return assignFields(documentId, { mitarbeiter: mitarbeiterId });
};

const assignVerlosungEintrag = async (documentId, mitarbeiterId) => {
  return assignFields(documentId, { mitarbeiter: mitarbeiterId }, async (document) => {
    if (document instanceof VerlosungEintrag) {
      await document.populate("mitarbeiter");
      logger.info(
        `✅ VerlosungEintrag assigned to: ${document.mitarbeiter?.vorname} ${document.mitarbeiter?.nachname}`
      );
    }
  });
};

async function assignFlipTask(req) {
  try {
    const { external_id, title, recipients, due_at, description } = req.body;

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
      due_at,
    });

    const existingTasks = await newTask.find();

    if (existingTasks.length > 0) {
      console.log(
        "⚠️ Task with external_id already exists. Skipping creation."
      );

      if (existingTasks.length === 1) {
        console.log("🔁 Updating existing task");
        const task = new FlipTask(existingTasks[0]); // Wrap in class
        task.title = newTask.title;
        task.body = newTask.body;
        task.recipients = newTask.recipients;
        task.due_at = newTask.due_at;
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
    const message = error.response ? error.response.data : error.message;
    console.error("❌ Error assigning Flip Task:", message);
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }
}
// ✅ Holt alle Assignments für eine bestimmte Task
async function getFlipTaskAssignments(taskId) {
  try {
    const response = await flipAxios.get(
      `/api/tasks/v4/tasks/${taskId}/assignments`
    );
    console.log(response.data.assignments);
    return response.data?.assignments || [];
  } catch (error) {
    console.error(
      `❌ Fehler beim Abrufen der Assignments auf ID: ${taskId}:`,
      error.response?.data || error.message
    );
    return [];
  }
}

// ✅ Holt alle Assignments für eine bestimmte Task
async function getFlipAssignments() {
  try {
    // Basierend auf Flip Support-Antwort: Komma-getrennt ohne Leerzeichen
    const response = await flipAxios.get(
      `/api/tasks/v4/tasks/assignments?distribution_kind=RECEIVED,PERSONAL`
    );
    console.log(response.data.assignments);
    return response.data?.assignments || [];
  } catch (error) {
    console.error(
      `❌ Fehler beim Abrufen der Assignments:`,
      error.response?.data || error.message
    );
    return [];
  }
}

// ✅ Markiert ein bestimmtes Assignment als abgeschlossen
async function markAssignmentAsCompleted(assignmentId) {
  try {
    const response = await flipAxios.post(
      `/api/tasks/v4/tasks/assignments/${assignmentId}/finish`,
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  } catch (error) {
    console.error(
      `❌ Fehler beim Abschließen des Assignments auf ID: ${assignmentId}`,
      error.response?.data || error.message
    );
    return false;
  }
}

async function deleteManyFlipUsers(ids) {
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const response = await flipAxios.delete("/api/admin/users/v4/users/batch", {
        headers: { "Content-Type": "application/json" },
        data: { items: chunk.map((id) => ({ id })) },
      });
      console.log(`🧹 Erfolgreich gelöscht (${chunk.length}):`, chunk);
      results.push(response.data);
    } catch (error) {
      console.error("❌ Fehler beim Löschen (Flip API):", error.response?.data || error.message);
      throw error;
    }
  }

  return results;
}


module.exports = {
  flipUserRoutine,
  asanaTransferRoutine,
  getFlipUsers,
  getFlipUserGroups,
  getFlipUserGroupAssignments,
  getFlipProfilePicture,
  findFlipUserByName,
  findFlipUserById,
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignVerlosungEintrag,
  assignFlipTask,
  getFlipTaskAssignments,
  markAssignmentAsCompleted,
  assignFlipUserGroups,
  deleteManyFlipUsers,
  getFlipAssignments,
};
