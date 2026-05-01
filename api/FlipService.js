const crypto = require("crypto");
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
const Einsatz = require("./models/Einsatz");
const Auftrag = require("./models/Auftrag");
const Qualifikation = require("./models/Qualifikation");
const { getRankTier, RANK_GROUP_IDS } = require("./config/flipRanks");
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
const FLIP_JOBS_MENU_ITEM_ID = process.env.FLIP_JOBS_MENU_ITEM_ID || "c672be9c-d742-4034-8aa3-5ff5afaf8e3c";
async function flipUserRoutine() {
  let emailLogs = [];
  let invalidLocations = [];
  let invalidDepartments = [];
  let emailMismatches = []; // { name, flipId, type, from, to }

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

      // ── Check Flip-side username ↔ email mismatch ──────────────────────────
      if (
        flipUser.benutzername &&
        flipUser.benutzername.includes('@') &&
        flipUser.email &&
        flipUser.benutzername.toLowerCase() !== flipUser.email.toLowerCase()
      ) {
        emailMismatches.push({
          name: `${flipUser.vorname} ${flipUser.nachname}`,
          flipId: flipUser.id,
          type: 'username≠email',
          from: flipUser.benutzername,
          to: flipUser.email,
        });
      }
      
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

      // ── Check Mitarbeiter.email ↔ Flip email mismatch ─────────────────────
      // If the stored primary email differs from Flip's email, add the Flip
      // email to additionalEmails so OIDC-based lookups still succeed.
      // Only report mismatch when a NEW additionalEmail is actually added.
      if (flipUser.email && mitarbeiter.email && mitarbeiter.email.toLowerCase() !== flipUser.email.toLowerCase()) {
        const normalizedFlipEmail = flipUser.email.toLowerCase().trim();
        if (!mitarbeiter.additionalEmails?.includes(normalizedFlipEmail)) {
          mitarbeiter.additionalEmails = [...(mitarbeiter.additionalEmails || []), normalizedFlipEmail];
          await mitarbeiter.save();
          emailMismatches.push({
            name: `${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
            flipId: flipUser.id,
            type: 'db≠flip',
            from: mitarbeiter.email,
            to: flipUser.email,
          });
          emailLogs.push(
            `📧 Flip-E-Mail als additionalEmail gespeichert: ${mitarbeiter.vorname} ${mitarbeiter.nachname} → ${normalizedFlipEmail}`
          );
        }
      }

      const shouldBeActive = (flipUser.status === "ACTIVE" || flipUser.status === "PENDING_DELETION");
      if (mitarbeiter.isActive !== shouldBeActive) {
        mitarbeiter.isActive = shouldBeActive;
        await mitarbeiter.save();
        emailLogs.push(
          `🟡 Mitarbeiter ${mitarbeiter.vorname} ${mitarbeiter.nachname} active status synced (${shouldBeActive})`
        );
      }

      // ── Set Flip location from Personalnr if location attribute is empty ──
      if (!flipUser.profile?.location && mitarbeiter?.personalnr) {
        const firstDigit = mitarbeiter.personalnr.charAt(0);
        const locationMap = { '1': 'Berlin', '2': 'Hamburg', '3': 'Köln' };
        const derivedLocation = locationMap[firstDigit];
        if (derivedLocation) {
          if (!flipUser.profile) flipUser.profile = {};
          flipUser.profile.location = derivedLocation;
          try {
            await flipUser.update();
            emailLogs.push(
              `📍 Location gesetzt für ${flipUser.vorname} ${flipUser.nachname}: "${derivedLocation}" (Personalnr: ${mitarbeiter.personalnr})`
            );
          } catch (err) {
            emailLogs.push(
              `❌ Fehler beim Setzen der Location für ${flipUser.vorname} ${flipUser.nachname}: ${err.message}`
            );
          }
        }
      }
    }

    const allMitarbeiter = await Mitarbeiter.find({
      flip_id: { $exists: true, $ne: null },
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
        } else {
          // Bereits inaktiv, aber flip_id wurde nie gecleart (z.B. manueller Austritt) → nachholen
          mitarbeiter.flip_id = null;
          await mitarbeiter.save();
          emailLogs.push(`🧹 flip_id bereinigt (bereits inaktiv): ${mitarbeiter.vorname} ${mitarbeiter.nachname}`);
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

    // 🔔 Update Laufzettel badges for all Teamleiter
    try {
      emailLogs.push("<br><br>🔔 Updating Flip Laufzettel badges...");
      const badgeResult = await updateAllTeamleiterBadges();
      emailLogs.push(`✅ Laufzettel badges updated for ${badgeResult} Teamleiter`);
    } catch (badgeErr) {
      const detail = badgeErr.response?.data ? JSON.stringify(badgeErr.response.data) : '';
      emailLogs.push(`⚠️ Laufzettel badge update failed: ${badgeErr.message}${detail ? ` — ${detail}` : ''}`);
    }
    
    // Sync attributes based on UserGroup assignments
    try {
      emailLogs.push("<br><br>🔄 Synchronizing Flip user attributes...");
      const syncResult = await syncFlipAttributes(Object.fromEntries(
        allFlipUsers.map(u => [u.id, u])
      ));
      emailLogs.push(`✅ Attribute sync completed: ${syncResult.updated} users synced, ${syncResult.changed.length} changed`);

      if (syncResult.changed.length > 0) {
        emailLogs.push(`<br><strong>🔄 Attribute-Änderungen (${syncResult.changed.length}):</strong>`);
        syncResult.changed.forEach(({ name, diff }) => {
          const parts = diff.map(d => `${d.attr}: <em>${d.before}</em> → <strong>${d.after}</strong>`).join(' &nbsp;·&nbsp; ');
          emailLogs.push(`&nbsp;&nbsp;👤 ${name}: ${parts}`);
        });
      }
      
      if (syncResult.errors.length > 0) {
        emailLogs.push(`⚠️ ${syncResult.errors.length} errors during attribute sync:`);
        syncResult.errors.slice(0, 10).forEach(err => {
          emailLogs.push(`   🔴 ${err.name}: ${err.error}`);
        });
        if (syncResult.errors.length > 10) {
          emailLogs.push(`   ... and ${syncResult.errors.length - 10} more errors`);
        }
      }
    } catch (syncError) {
      emailLogs.push(`❌ Error during attribute sync: ${syncError.message}`);
    }
    
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

    // 🏅 Rank Group Sync
    try {
      emailLogs.push("<br><br>🏅 Synchronisiere Rang-Gruppen...");
      const rankResult = await syncRankGroups(allMitarbeiter);
      emailLogs.push(...rankResult.logs.map(l => `&nbsp;&nbsp;${l}`));
    } catch (rankErr) {
      emailLogs.push(`⚠️ Rang-Sync fehlgeschlagen: ${rankErr.message}`);
    }

    // 📅 Kalender-Sync — Einsätze für alle isOffice-Mitarbeiter
    try {
      emailLogs.push("<br><br>📅 Synchronisiere Flip-Kalender für Office-Mitarbeiter...");
      const now = new Date();
      let calCreated = 0, calUpdated = 0, calUnchanged = 0, calCancelled = 0, calSkipped = 0, calErrors = 0;

      // ── TEMP TEST: nur Testuser ──────────────────────────────────────────
      // TODO: Zurück auf isOffice-Filter wenn Kalender-Sync korrekt getestet:
      // const officeFlipUsers = allFlipUsers.filter((u) => {
      //   const attrs = Array.isArray(u.attributes) ? u.attributes : [];
      //   return attrs.find((a) => a.name === "isOffice")?.value === "true";
      // });
      const officeFlipUsers = allFlipUsers.filter(
        (u) => u.email?.toLowerCase() === "cedricbglx@gmail.com"
      );
      // ────────────────────────────────────────────────────────────────────

      // Pre-fetch ALL future Flip events before the sync loop.
      // FIX: Previously createFlipCalendarEvent() was called on every run, which
      // caused a re-invitation notification on each POST even for existing events.
      // Now we only POST (= create + invite) for genuinely new events.
      const existingEventsMap = new Map();
      try {
        const allFutureEvents = await listAllFlipCalendarEvents({
          start_after: now.toISOString(),
        });
        for (const ev of allFutureEvents) {
          existingEventsMap.set(ev.id, ev);
        }
        emailLogs.push(`ℹ️ ${allFutureEvents.length} bestehende Flip-Events geladen`);
      } catch (fetchErr) {
        emailLogs.push(`⚠️ Pre-fetch fehlgeschlagen, fahre fort: ${fetchErr.message}`);
      }

      // Set of event IDs that SHOULD exist after this sync run.
      // Used afterwards to identify orphan events that need to be cancelled.
      const expectedEventIds = new Set();

      for (const flipUserData of officeFlipUsers) {
        const ma = await Mitarbeiter.findOne({ flip_id: flipUserData.id });
        if (!ma?.personalnr || !ma.flip_id) continue;

        const einsaetze = await Einsatz.find({
          personalNr: Number(ma.personalnr),
          isPseudo: { $ne: true },
          $or: [
            { detailDatumVon: { $gte: now } },
            { datumVon: { $gte: now } },
          ],
        });

        for (const einsatz of einsaetze) {
          try {
            const auftrag = await Auftrag.findOne({ auftragNr: einsatz.auftragNr });
            const payload = buildEinsatzCalendarPayload(einsatz, auftrag, ma.flip_id);
            if (!payload) { calSkipped++; continue; }

            expectedEventIds.add(payload.id);

            const existingEvent = existingEventsMap.get(payload.id);

            if (existingEvent) {
              // Event already exists — only PATCH if something changed, never re-invite
              if (flipEventMatchesPayload(existingEvent, payload)) {
                calUnchanged++;
              } else {
                const { id: _id, participants: _p, ...patch } = payload;
                patch.participants_notification = "NO_NOTIFICATION";
                await updateFlipCalendarEvent(payload.id, patch);
                calUpdated++;
              }
            } else {
              // New event — POST creates it and sends the invitation exactly once
              await createFlipCalendarEvent(payload);
              calCreated++;
            }
          } catch (calErr) {
            calErrors++;
            logger.error(
              `flipUserRoutine: Kalender-Fehler Einsatz ${einsatz._id}:`,
              calErr.response?.data || calErr.message
            );
          }
        }
      }

      // ── Orphan-Cleanup: zukünftige Events löschen, deren Einsatz nicht mehr existiert ──
      // NOTE: Disabled while in single-user test mode — iterating existingEventsMap would
      // cancel events belonging to other users (since expectedEventIds is incomplete).
      // TODO: Re-enable once the isOffice-Filter above is restored for all users.
      //
      // try {
      //   for (const [evId, ev] of existingEventsMap) {
      //     if (expectedEventIds.has(evId)) continue;
      //     if (ev.status === "CANCELLED") continue;
      //     await updateFlipCalendarEvent(evId, {
      //       status: "CANCELLED",
      //       participants_notification: "NO_NOTIFICATION",
      //     });
      //     calCancelled++;
      //   }
      // } catch (orphanErr) {
      //   emailLogs.push(`⚠️ Orphan-Cleanup fehlgeschlagen: ${orphanErr.message}`);
      // }

      emailLogs.push(
        `✅ Kalender-Sync: ${calCreated} neu, ${calUpdated} aktualisiert, ${calUnchanged} unverändert, ${calCancelled} abgesagt, ${calSkipped} übersprungen, ${calErrors} Fehler (${officeFlipUsers.length} Office-User)`
      );
    } catch (calSyncErr) {
      emailLogs.push(`⚠️ Kalender-Sync fehlgeschlagen: ${calSyncErr.message}`);
    }

    // Add email mismatch report
    if (emailMismatches.length > 0) {

      emailMismatches.forEach(({ name, flipId, type, from, to }) => {
        const label = type === 'username≠email'
          ? '🔁 Flip Username ≠ E-Mail'
          : '🔀 DB-E-Mail ≠ Flip-E-Mail (→ additionalEmails ergänzt)';
        emailLogs.push(`${label}: <strong>${name}</strong> (${flipId})<br>&nbsp;&nbsp;&nbsp;Von: <em>${from}</em> → Zu: <strong>${to}</strong>`);
      });
    } else {
      emailLogs.push("<br>✅ Keine E-Mail-Mismatches gefunden.");
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
  try {
    // 1) Direkter Avatar-Endpunkt pro User (wenn Flip das anbietet)
    const direct = await flipAxios.get(`/api/admin/users/v4/users/${userId}/avatar`, {
      responseType: 'arraybuffer'
    });
    
    return {
      data: direct.data,
      contentType: direct.headers['content-type'] || 'image/jpeg',
    };
  } catch (err1) {
    const status = err1.response?.status;
    
    if (status && status !== 404) {
      return null;
    }
    // 404 → weiter mit Weg 2
  }

  try {
    // 2) User lesen → Media-ID ermitteln → Media holen
    const userResp = await flipAxios.get(`/api/admin/users/v4/users/${userId}`);
    const u = userResp.data || {};

    // möglichst robust alle bekannten Varianten prüfen
    const mediaId =
      u.avatar_media_id ||
      u.profile_image_media_id ||
      u.profile_picture_id ||
      u?.avatar?.file_id ||
      u?.avatar?.id ||
      u?.profile_image?.file_id ||
      u?.profile_image?.id ||
      u?.profile_picture?.file_id ||
      u?.profile_picture?.id ||
      u?.profile?.picture?.file_id;

    if (!mediaId) {
      return null;
    }
    const mediaResp = await flipAxios.get(`/media/avatars/${mediaId}`, {
      responseType: 'arraybuffer'
    });

    return {
      data: mediaResp.data,
      contentType: mediaResp.headers['content-type'] || 'image/jpeg',
    };
  } catch (err2) {
    return null;
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

/**
 * Fetches ALL user groups with pagination (page_limit default 25).
 * Returns flat array of group objects with { id, title, status, type, ... }.
 */
async function getAllFlipUserGroups(params = {}) {
  const allGroups = [];
  let currentPage = 1;
  let totalPages = 1;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    do {
      const reqParams = { ...params, page_number: currentPage, page_limit: 100 };
      try {
        const response = await flipAxios.get("/api/admin/users/v4/user-groups", { params: reqParams });
        if (response.data?.groups) {
          allGroups.push(...response.data.groups);
        }
        const pagination = response.data?.pagination;
        if (pagination) {
          totalPages = pagination.total_pages ?? 1;
          currentPage++;
        } else {
          break;
        }
      } catch (reqError) {
        if (reqError.response?.status === 429) {
          console.warn(`⏳ Rate limited (429). Waiting 2s before retrying page ${currentPage}...`);
          await sleep(2000);
          continue;
        }
        throw reqError;
      }
      await sleep(200);
    } while (currentPage <= totalPages);

    return allGroups;
  } catch (error) {
    console.error("❌ Error fetching all Flip user groups:", error.response?.data || error.message);
    throw new Error("Failed to fetch all Flip user groups");
  }
}

/**
 * Fetches ALL assignments for a given group_id with pagination.
 * Returns flat array of assignment objects.
 */
async function getAllFlipUserGroupAssignments(groupId) {
  const allAssignments = [];
  let currentPage = 1;
  let totalPages = 1;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    do {
      const params = { page_number: currentPage, page_limit: 100 };
      try {
        const response = await flipAxios.get(
          `/api/admin/users/v4/user-groups/${groupId}/assignments`,
          { params }
        );
        if (response.data?.assignments) {
          allAssignments.push(...response.data.assignments);
        }
        const pagination = response.data?.pagination;
        if (pagination) {
          totalPages = pagination.total_pages ?? 1;
          currentPage++;
        } else {
          break;
        }
      } catch (reqError) {
        if (reqError.response?.status === 429) {
          console.warn(`⏳ Rate limited (429). Waiting 2s before retrying page ${currentPage}...`);
          await sleep(2000);
          continue;
        }
        throw reqError;
      }
      await sleep(200);
    } while (currentPage <= totalPages);

    return allAssignments;
  } catch (error) {
    console.error(`❌ Error fetching all assignments for group ${groupId}:`, error.response?.data || error.message);
    throw new Error("Failed to fetch all Flip user group assignments");
  }
}

/** Builds an HTML snippet with context info for error emails */
function _buildContextHtml(context = {}) {
  const { requestingUser, flipUser } = context;
  if (!requestingUser && !flipUser) return "";
  let html = `<table style="border-collapse:collapse;margin:12px 0;font-size:13px;">`;
  if (requestingUser) {
    html += `<tr><th colspan="2" style="text-align:left;padding:6px 10px;background:#f4f4f4;border:1px solid #ddd;">Ausführender User (Monitor)</th></tr>`;
    if (requestingUser.id)       html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">ID</td><td style="padding:5px 10px;border:1px solid #ddd;">${requestingUser.id}</td></tr>`;
    if (requestingUser.name)     html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">Name</td><td style="padding:5px 10px;border:1px solid #ddd;">${requestingUser.name}</td></tr>`;
    if (requestingUser.email)    html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">E-Mail</td><td style="padding:5px 10px;border:1px solid #ddd;">${requestingUser.email}</td></tr>`;
    if (requestingUser.location) html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">Standort</td><td style="padding:5px 10px;border:1px solid #ddd;">${requestingUser.location}</td></tr>`;
  }
  if (flipUser) {
    html += `<tr><th colspan="2" style="text-align:left;padding:6px 10px;background:#f4f4f4;border:1px solid #ddd;">Betroffener Flip-User</th></tr>`;
    if (flipUser.id)    html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">Flip ID</td><td style="padding:5px 10px;border:1px solid #ddd;">${flipUser.id}</td></tr>`;
    if (flipUser.name)  html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">Name</td><td style="padding:5px 10px;border:1px solid #ddd;">${flipUser.name}</td></tr>`;
    if (flipUser.email) html += `<tr><td style="padding:5px 10px;border:1px solid #ddd;font-weight:600;">E-Mail</td><td style="padding:5px 10px;border:1px solid #ddd;">${flipUser.email}</td></tr>`;
  }
  html += `</table>`;
  return html;
}

async function assignFlipUserGroups(req, context = {}) {
  // context: { requestingUser: { id, name, email, location }, flipUser: { id, email, name } }
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

      const contextInfo = _buildContextHtml(context);
      const errorMessage = `
        <h2>❌ Error Assigning Users to User Groups</h2>
        <p>Some user group assignments failed with status 400.</p>
        ${contextInfo}
        <pre>${JSON.stringify(response.data, null, 2)}</pre>
      `;

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

    const contextInfo = _buildContextHtml(context);
    const errorMessage = `
      <h2>❌ Critical Error Assigning Users to User Groups</h2>
      <p>An unexpected error occurred while assigning user groups.</p>
      ${contextInfo}
      <pre>${errorDetails}</pre>
    `;

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
    // v2: Skip array pushes — refs on the document are the source of truth
    if (updates.mitarbeiter) {
      const mitarbeiter = await Mitarbeiter.findById(updates.mitarbeiter);
      if (mitarbeiter) {
        const isV2 = documentFound.version === "v2";

        if (!isV2) {
          // Legacy v1: push to arrays on Mitarbeiter
          if (documentFound instanceof Laufzettel) {
            mitarbeiter.laufzettel_submitted.push(documentFound._id);
          } else if (documentFound instanceof EvaluierungMA) {
            mitarbeiter.evaluierungen_received.push(documentFound._id);
          }
          await mitarbeiter.save();
        }
      }
    }

    // If updates include teamleiter, update their document references
    // v2: Skip array pushes — refs on the document are the source of truth
    if (updates.teamleiter) {
      const teamleiter = await Mitarbeiter.findById(updates.teamleiter);
      if (teamleiter) {
        const isV2 = documentFound.version === "v2";

        if (!isV2) {
          // Legacy v1: push to arrays on Mitarbeiter
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

        const laufzettelId = document._id.toString();
        const evaluierungUrl = `https://flipcms.de/integration/flipcms/hpstraightforward/evaluierung-ma/?wpf176_20_first=${encodeURIComponent(mitarbeiter.vorname)}&wpf176_20_last=${encodeURIComponent(mitarbeiter.nachname)}&wpf176_23=${laufzettelId}`;

        try {
          const task = await assignFlipTask({
            body: {
              external_id: laufzettelId,
              title: `Neuer Laufzettel: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
              recipients: [{ id: teamleiter.flip_id, type: "USER" }],
              due_at: {
                date: formattedDueDate,
                due_at_type: "DATE",
              },
              description: `Du hast einen neuen Laufzettel erhalten.<br><br>Bitte fülle die Bewertung für <strong>${mitarbeiter.vorname} ${mitarbeiter.nachname}</strong> aus.<br><br>Du findest den Laufzettel im Menüpunkt <strong>„Jobs“</strong>.`,
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

/**
 * Restore a deleted/pending-deletion Flip user by ID.
 * Flip API: POST /api/admin/users/v4/users/{id}/restore
 */
async function restoreFlipUser(id) {
  const response = await flipAxios.post(`/api/admin/users/v4/users/${id}/restore`);
  return response.data;
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

const TRACKED_ATTRS = ['isService', 'isLogistik', 'isOffice', 'isTeamLead', 'isFesti'];

/**
 * Sync Flip user attributes (isService, isLogistik, isOffice, isTeamLead, isFesti)
 * based on Berufe/Qualifikationen in MongoDB.
 *
 * @param {Object} [flipUsersById={}]  Pre-fetched map of flip_id → raw Flip user object.
 *   When provided, individual GET calls are skipped (saves N API requests).
 *   Pass `Object.fromEntries(allFlipUsers.map(u => [u.id, u]))` from flipUserRoutine.
 */
async function syncFlipAttributes(flipUsersById = {}) {
  const Mitarbeiter = require('./models/Mitarbeiter');

  // 1. Alle Mitarbeiter mit flip_id holen (populated berufe/qualifikationen)
  const mitarbeiter = await Mitarbeiter.find({
    flip_id: { $exists: true, $ne: null },
    isActive: true
  })
  .populate('berufe')
  .populate('qualifikationen')
  .lean();

  const batchItems = [];
  const errors = [];
  const updates = [];
  const changed = []; // users where tracked attrs differ from Flip's current state

  for (const ma of mitarbeiter) {
    try {
      const berufKeys  = (ma.berufe        || []).map(b => Number(b.jobKey)).filter(k => !isNaN(k));
      const qualiKeys  = (ma.qualifikationen || []).map(q => Number(q.qualificationKey)).filter(k => !isNaN(k));

      // Wenn keine Berufe hinterlegt sind, isService/isLogistik nicht überschreiben —
      // der MA wurde initial evtl. mit isService=true angelegt und hat noch keinen Einsatz.
      const hasBeruf   = berufKeys.length > 0;
      const isService  = hasBeruf ? berufKeys.includes(10001) : null;
      const isLogistik = hasBeruf ? berufKeys.includes(10002) : null;
      const isOffice   = qualiKeys.includes(40);    // Quali-Key 40 = Office
      const isTeamLead = qualiKeys.includes(50055);
      const isFesti    = ma.persgruppe === 101 || ma.persgruppe == 101; // persgruppe 101 = Festangestellt

      // Re-use pre-fetched data or fall back to individual GET
      let flipUserData = flipUsersById[ma.flip_id];
      if (!flipUserData) {
        flipUserData = await findFlipUserById(ma.flip_id);
      }
      if (!flipUserData) {
        errors.push({ id: ma._id, name: `${ma.vorname} ${ma.nachname}`, error: 'Flip User nicht gefunden' });
        continue;
      }

      // Build before-map from existing Flip attributes
      const beforeMap = {};
      (flipUserData.attributes || []).forEach(a => {
        const key = a.name || a.technical_name;
        if (TRACKED_ATTRS.includes(key)) beforeMap[key] = a.value;
      });

      // isService/isLogistik sind null wenn keine Berufe → nicht in afterMap aufnehmen
      const afterMap = { isOffice: String(isOffice), isTeamLead: String(isTeamLead), isFesti: String(isFesti) };
      if (isService  !== null) afterMap.isService  = String(isService);
      if (isLogistik !== null) afterMap.isLogistik = String(isLogistik);

      // Detect changes among tracked attributes (nur gesetzte Werte vergleichen)
      const diff = TRACKED_ATTRS
        .filter(attr => afterMap[attr] !== undefined)
        .map(attr => ({ attr, before: beforeMap[attr] ?? '?', after: afterMap[attr] }))
        .filter(d => d.before !== d.after);
      if (diff.length > 0) {
        changed.push({ name: `${ma.vorname} ${ma.nachname}`, diff });
      }

      // Attributes: start from existing Flip attributes, then overlay computed values.
      // This preserves any attributes not managed by this sync (e.g. job_title, phone).
      const managedKeys = new Set([
        ...TRACKED_ATTRS,
        'location',
        'department',
      ]);

      const newAttrsMap = {};
      if (isService  !== null) newAttrsMap.isService  = String(isService);
      if (isLogistik !== null) newAttrsMap.isLogistik = String(isLogistik);
      newAttrsMap.isOffice   = String(isOffice);
      newAttrsMap.isTeamLead = String(isTeamLead);
      newAttrsMap.isFesti    = String(isFesti);

      const profile = flipUserData.profile || {};
      if (profile.location)   newAttrsMap.location   = profile.location;
      if (profile.department) newAttrsMap.department = profile.department;

      // Preserve all existing attributes that we don't manage
      const attributes = (flipUserData.attributes || [])
        .filter(a => !managedKeys.has(a.name || a.technical_name))
        .map(a => ({ name: a.name || a.technical_name, value: a.value }));

      // Append managed attributes with computed values
      for (const [name, value] of Object.entries(newAttrsMap)) {
        attributes.push({ name, value });
      }

      batchItems.push({
        id: ma.flip_id,
        body: { attributes },
      });

      updates.push({ id: ma._id, name: `${ma.vorname} ${ma.nachname}`, attributes: attributes.map(a => a.name) });
    } catch (error) {
      errors.push({ id: ma._id, name: `${ma.vorname} ${ma.nachname}`, error: error.message });
    }
  }

  // 2. Batch-Updates in 50er-Chunks senden
  const CHUNK = 50;
  for (let i = 0; i < batchItems.length; i += CHUNK) {
    const chunk = batchItems.slice(i, i + CHUNK);
    try {
      const res = await flipAxios.patch('/api/admin/users/v4/users/batch', { items: chunk }, {
        headers: { 'content-type': 'application/json' },
      });
      // Log per-item failures returned by the batch endpoint
      (res.data?.items || []).forEach(item => {
        if (item.status !== 200) {
          const maName = updates.find(u => u.id)?.name || item.id;
          errors.push({ id: item.id, name: maName, error: item.error?.code || `HTTP ${item.status}` });
        }
      });
    } catch (batchErr) {
      logger.warn(`⚠️ Flip batch update chunk ${i}–${i + chunk.length} failed: ${batchErr.message}`);
      chunk.forEach(item => errors.push({ id: item.id, name: item.id, error: batchErr.message }));
    }
  }

  return {
    updated: updates.length,
    errors: errors.length,
    updates,
    errors,
    changed,
  };
}


// ──────────────────────────────────────────────────────────────────────────────
// 🔔 Flip Menu Badge: Offene Laufzettel für Teamleiter
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Updates the Flip navigation badge for a single Teamleiter.
 * badge_count = number of Laufzettel with status OFFEN assigned to this TL.
 * @param {mongoose.Types.ObjectId|string} mitarbeiterId - DB _id of the Teamleiter Mitarbeiter
 */
async function updateLaufzettelBadge(mitarbeiterId) {
  const ma = await Mitarbeiter.findById(mitarbeiterId).select('flip_id vorname nachname').lean();
  if (!ma?.flip_id) return;

  const count = await Laufzettel.countDocuments({ teamleiter: mitarbeiterId, status: 'OFFEN' });

  await flipAxios.post(`/api/navigation/v4/menu-items/${FLIP_JOBS_MENU_ITEM_ID}/badge`, {
    badges: [{ user_id: ma.flip_id, badge_count: count }],
  }).catch(err => {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.warn(`⚠️ Flip badge POST failed (${err.response?.status ?? '?'}): ${detail}`);
    throw err;
  });

  logger.info(`🔔 Flip badge updated: ${ma.vorname} ${ma.nachname} → ${count} offene Laufzettel`);
}


/**
 * Updates Flip navigation badges for ALL Teamleiter (qualification key 50055).
 * Sends a single API call with all badge entries.
 * @returns {number} number of Teamleiter updated
 */
async function updateAllTeamleiterBadges() {
  const teamleiterQual = await Qualifikation.findOne({ qualificationKey: 50055 }).lean();
  if (!teamleiterQual) return 0;

  const allTL = await Mitarbeiter.find({
    qualifikationen: teamleiterQual._id,
    flip_id: { $exists: true, $ne: null },
  }).select('_id flip_id vorname nachname').lean();

  if (!allTL.length) return 0;

  const tlIds = allTL.map(t => t._id);
  const counts = await Laufzettel.aggregate([
    { $match: { status: 'OFFEN', teamleiter: { $in: tlIds } } },
    { $group: { _id: '$teamleiter', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map(c => [String(c._id), c.count]));

  const badges = allTL
    .filter(t => t.flip_id)
    .map(t => ({ user_id: t.flip_id, badge_count: countMap.get(String(t._id)) || 0 }));

  try {
    await flipAxios.post(`/api/navigation/v4/menu-items/${FLIP_JOBS_MENU_ITEM_ID}/badge`, { badges });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.warn(`⚠️ Flip bulk badge POST failed (${err.response?.status ?? '?'}): ${detail}`);
    throw err;
  }

  logger.info(`🔔 Flip badges bulk-updated for ${badges.length} Teamleiter`);
  return badges.length;
}

/**
 * Synchronisiert Rang-Gruppen für alle Mitarbeiter mit Flip-Account.
 * Berechnet vergangene Einsätze (inkl. Personalnr-History), ermittelt Rang,
 * fügt User zur Rang-Gruppe hinzu und setzt sie als Primary Group.
 * Idempotent: überspringt User ohne Rang-Änderung.
 *
 * @param {Array} mitarbeiterList - Array von Mongoose Mitarbeiter-Dokumenten
 * @returns {Promise<{ promoted: number, unchanged: number, errors: number, logs: string[] }>}
 */
async function syncRankGroups(mitarbeiterList) {
  const now = new Date();
  const logs = [];
  let promoted = 0;
  let unchanged = 0;
  let errors = 0;

  const eligible = mitarbeiterList.filter(
    ma => ma.flip_id && ma.isActive !== false && (ma.personalnr || (ma.personalnrHistory && ma.personalnrHistory.length > 0))
  );

  logs.push(`🏅 Rank sync: ${eligible.length} Mitarbeiter mit Flip-Account und Personalnr`);

  // Process in chunks to avoid hitting Flip rate limit (600 req/min)
  const CHUNK_SIZE = 20;
  for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
    const chunk = eligible.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (ma) => {
      try {
        // Collect all personalnr values (current + history)
        const allNrs = new Set();
        if (ma.personalnr) allNrs.add(Number(ma.personalnr));
        if (Array.isArray(ma.personalnrHistory)) {
          ma.personalnrHistory.forEach(h => {
            if (h.value) allNrs.add(Number(h.value));
          });
        }
        const nrArray = [...allNrs].filter(n => !isNaN(n) && n > 0);
        if (nrArray.length === 0) return;

        const count = await Einsatz.countDocuments({
          personalNr: { $in: nrArray },
          datumBis: { $lt: now },
        });

        const tier = getRankTier(count);
        if (!tier) return; // Keine Einsätze → kein Rang

        // Idempotenz-Check
        if (ma.rank === tier.key) {
          unchanged++;
          return;
        }

        // Flip: zur Rang-Gruppe hinzufügen + als Primary setzen
        const flipUser = new (require("./models/Classes/FlipUser"))({ id: ma.flip_id });
        await flipUser.addToGroup(tier.groupId, { setPrimary: true });

        // DB: Rang cachen
        const prevRank = ma.rank;
        ma.rank = tier.key;
        ma.einsatzCount = count;
        await Mitarbeiter.updateOne({ _id: ma._id }, { rank: tier.key, einsatzCount: count });

        promoted++;
        const arrow = prevRank ? `${prevRank} → ${tier.key}` : `neu: ${tier.key}`;
        logs.push(`🏅 ${ma.vorname} ${ma.nachname}: ${arrow} (${count} Einsätze)`);
      } catch (err) {
        errors++;
        logs.push(`❌ Rang-Sync Fehler ${ma.vorname} ${ma.nachname}: ${err.message}`);
      }
    }));
  }

  logs.push(`✅ Rang-Sync abgeschlossen: ${promoted} aktualisiert, ${unchanged} unverändert, ${errors} Fehler`);
  return { promoted, unchanged, errors, logs };
}

// ─── Flip Calendar API ───────────────────────────────────────────────────────

/**
 * Get calendar events for the authenticated Flip user.
 * @param {{ start_after?, start_before?, end_after?, end_before?, rsvp_status?, order_by?, page_cursor?, page_limit? }} params
 */
async function getFlipCalendarEvents(params = {}) {
  const response = await flipAxios.get("/api/calendar/v4/calendar/me/events", { params });
  return response.data;
}

/**
 * Creates a deterministic UUID (v4-formatted) from a MongoDB ObjectId string.
 * Used as the Flip API idempotency key so that re-running the sync never
 * creates duplicate calendar events for the same Einsatz.
 */
function einsatzToFlipEventId(einsatzId) {
  const hash = crypto.createHash("sha256").update(`einsatz:${einsatzId}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Returns the offset of Europe/Berlin at the given date as "+HH:MM".
 * Handles CET/CEST automatically via the Intl API.
 */
function berlinOffset(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tzName = parts.find(p => p.type === "timeZoneName")?.value || "GMT+1";
  // tzName looks like "GMT+2" or "GMT+1"
  const m = tzName.match(/GMT([+-]\d+)/);
  const hours = m ? parseInt(m[1], 10) : 1;
  const sign = hours >= 0 ? "+" : "-";
  const abs  = Math.abs(hours);
  return `${sign}${String(abs).padStart(2, "0")}:00`;
}

/**
 * Combine a date and a "HH:MM" string into an ISO 8601 string with explicit
 * Europe/Berlin offset (e.g. "2026-05-12T10:00:00+02:00"). DST-aware.
 * Flip's API requires an offset on time_slot.start/end.
 */
function buildCalendarDateTime(date, timeStr) {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  let hh = "00", min = "00";
  if (timeStr) {
    const parts = String(timeStr).split(":");
    hh  = String(parseInt(parts[0], 10)).padStart(2, "0");
    min = String(parseInt(parts[1] || "0", 10)).padStart(2, "0");
  }
  // Build a proper Date in Berlin time to compute the offset for that instant
  const naive = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  const probe = new Date(`${naive}Z`);
  const offset = berlinOffset(probe);
  return `${naive}${offset}`;
}

/**
 * Add hours to a Berlin-offset ISO string and return another such string.
 */
function addHoursToBerlinIso(berlinIso, hours) {
  const d = new Date(berlinIso);
  d.setUTCHours(d.getUTCHours() + hours);
  // Re-format keeping Berlin offset for the new instant
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  // Convert UTC back to Berlin local using offset
  const offset = berlinOffset(d);
  const offsetHours = parseInt(offset.slice(0, 3), 10);
  const localD = new Date(d.getTime() + offsetHours * 3600 * 1000);
  const lh = String(localD.getUTCHours()).padStart(2, "0");
  const lm = String(localD.getUTCMinutes()).padStart(2, "0");
  return `${localD.getUTCFullYear()}-${String(localD.getUTCMonth() + 1).padStart(2, "0")}-${String(localD.getUTCDate()).padStart(2, "0")}T${lh}:${lm}:00${offset}`;
}

/**
 * Builds the Flip calendar event payload from an Einsatz + Auftrag for a given Flip user.
 * Returns null if the Einsatz lacks a usable start date.
 */
function buildEinsatzCalendarPayload(einsatz, auftrag, flipUserId) {
  const startDate = einsatz.detailDatumVon || einsatz.datumVon;
  if (!startDate) return null;

  const start = buildCalendarDateTime(startDate, einsatz.uhrzeitVon);
  let end = buildCalendarDateTime(
    einsatz.detailDatumBis || einsatz.datumBis || startDate,
    einsatz.uhrzeitBis
  );
  if (!end || end === start) end = addHoursToBerlinIso(start, 1);

  const rawTitle =
    auftrag?.eventTitel ||
    einsatz.schichtBezeichnung ||
    einsatz.bezeichnung ||
    `Einsatz ${einsatz.auftragNr}`;

  const locationParts = [
    auftrag?.eventLocation || auftrag?.eventStrasse,
    [auftrag?.eventPlz, auftrag?.eventOrt].filter(Boolean).join(" "),
  ].filter(Boolean);
  const location = locationParts
    .join(", ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  const data = {
    id: einsatzToFlipEventId(einsatz._id),
    title: String(rawTitle).substring(0, 200),
    time_slot: { start, end, time_zone: "Europe/Berlin" },
    participants: [{ type: "USER", id: flipUserId }],
  };
  if (location.length) data.location = location.substring(0, 1000);
  return data;
}

/**
 * Returns true if the existing Flip event matches the desired payload
 * (title, time_slot.start/end/time_zone, location).
 */
function flipEventMatchesPayload(existing, desired) {
  if (!existing) return false;
  if (existing.title !== desired.title) return false;
  const ts = existing.time_slot || {};
  const ds = desired.time_slot || {};
  if (ts.start !== ds.start) return false;
  if (ts.end !== ds.end) return false;
  if (ts.time_zone !== ds.time_zone) return false;
  if ((existing.location || "") !== (desired.location || "")) return false;
  return true;
}

/**
 * Paginates through /me/events with the given filters and returns ALL items.
 */
async function listAllFlipCalendarEvents(filters = {}) {
  const all = [];
  let cursor;
  do {
    const params = { ...filters, page_limit: 100 };
    if (cursor) params.page_cursor = cursor;
    const data = await getFlipCalendarEvents(params);
    if (Array.isArray(data?.items)) all.push(...data.items);
    cursor = data?.pagination?.next_cursor || null;
  } while (cursor);
  return all;
}

/**
 * Create a calendar event.
 * @param {{ title, time_slot, location?, body?, participants?, attachments?, show_participant_list?, id? }} eventData
 */
async function createFlipCalendarEvent(eventData) {
  const response = await flipAxios.post("/api/calendar/v4/calendar/me/events", eventData);
  return response.data;
}

/**
 * Get a counts overview of upcoming events (today, tomorrow, this_week, pending_invites).
 * @param {string} timeZone - IANA time zone identifier, e.g. "Europe/Berlin"
 */
async function getFlipCalendarOverview(timeZone) {
  const response = await flipAxios.get("/api/calendar/v4/calendar/me/events/overview", {
    params: { time_zone: timeZone },
  });
  return response.data;
}

/**
 * Get full details for a single calendar event.
 * @param {string} eventId
 * @param {string[]} [bodyFormat] - e.g. ["PLAIN", "HTML"]
 */
async function getFlipCalendarEvent(eventId, bodyFormat) {
  const params = {};
  if (bodyFormat && bodyFormat.length) params.body_format = bodyFormat;
  const response = await flipAxios.get(`/api/calendar/v4/calendar/me/events/${eventId}`, { params });
  return response.data;
}

/**
 * Partially update a calendar event (JSON Merge Patch / RFC 7396).
 * Only the organizer can update.
 * @param {string} eventId
 * @param {object} patch - Fields to update (title, time_slot, location, status, body, attachments, show_participant_list, participants_notification)
 */
async function updateFlipCalendarEvent(eventId, patch) {
  const response = await flipAxios.patch(
    `/api/calendar/v4/calendar/me/events/${eventId}`,
    patch,
    { headers: { "Content-Type": "application/merge-patch+json" } }
  );
  return response.data;
}

// ─── Flip Files API ──────────────────────────────────────────────────────────

/**
 * Step 1: Register a new file with the Flip API.
 * Returns { file_id, signed_url, url_expiry_date, status }.
 */
async function createFlipFile({ fileName, mediaTypeHint, mediaConversion, source = "WEB" }) {
  const body = { file_name: fileName, source };
  if (mediaTypeHint) body.media_type_hint = mediaTypeHint;
  if (mediaConversion) body.media_conversion = mediaConversion;

  const response = await flipAxios.post("/api/files/v4/files", body);
  return response.data;
}

/**
 * Step 2: Upload raw file bytes to the Flip-provided signed URL.
 * @param {string} signedUrl - The pre-signed PUT URL from createFlipFile.
 * @param {Buffer} fileBuffer - Raw file bytes.
 * @param {string} mimeType - MIME type of the file (e.g. "application/pdf").
 */
async function uploadToFlipSignedUrl(signedUrl, fileBuffer, mimeType) {
  const axios = require("axios");
  await axios.put(signedUrl, fileBuffer, {
    headers: { "Content-Type": mimeType },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

/**
 * Step 3: Poll file status until FINISHED or FAILURE (or timeout).
 * @param {string} fileId
 * @param {{ intervalMs?: number, maxAttempts?: number }} options
 * @returns {Promise<{ file_id: string, status: string, failure_reason?: string }>}
 */
async function pollFlipFileStatus(fileId, { intervalMs = 2000, maxAttempts = 30 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await flipAxios.get(`/api/files/v4/files/${fileId}`);
    const { status, failure_reason } = response.data;

    if (status === "FINISHED") return response.data;
    if (status === "FAILURE") {
      throw new Error(`Flip file processing failed: ${failure_reason || "unknown reason"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Flip file ${fileId} did not finish processing within timeout`);
}

/**
 * Full upload helper: create → upload → poll.
 * @param {{ fileName: string, fileBuffer: Buffer, mimeType: string, mediaTypeHint?: string }} params
 * @returns {Promise<string>} The finished file_id ready to be used in Flip.
 */
async function uploadFileToFlip({ fileName, fileBuffer, mimeType, mediaTypeHint }) {
  const { file_id, signed_url } = await createFlipFile({ fileName, mediaTypeHint });
  await uploadToFlipSignedUrl(signed_url, fileBuffer, mimeType);
  await pollFlipFileStatus(file_id);
  return file_id;
}

module.exports = {
  flipUserRoutine,
  syncRankGroups,
  syncFlipAttributes,
  asanaTransferRoutine,
  getFlipUsers,
  getFlipUserGroups,
  getFlipUserGroupAssignments,
  getAllFlipUserGroups,
  getAllFlipUserGroupAssignments,
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
  restoreFlipUser,
  deleteManyFlipUsers,
  getFlipAssignments,
  updateLaufzettelBadge,
  updateAllTeamleiterBadges,
  createFlipFile,
  uploadToFlipSignedUrl,
  pollFlipFileStatus,
  uploadFileToFlip,
  getFlipCalendarEvents,
  createFlipCalendarEvent,
  getFlipCalendarOverview,
  getFlipCalendarEvent,
  updateFlipCalendarEvent,
};
