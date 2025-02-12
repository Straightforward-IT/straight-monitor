const stringSimilarity = require("string-similarity");
const mongoose = require("mongoose");
const { flipAxios } = require("./flipAxios");
const  FlipUser  = require("./models/Classes/FlipUser");
const FlipTask = require("./models/Classes/FlipTask");
const { Laufzettel, EventReport, EvaluierungMA } = require("./models/FlipDocs");
const Mitarbeiter = require("./models/Mitarbeiter");
require("dotenv").config();


async function flipUserRoutine() {
  try {
    console.log("🔄 Running Flip API user refresh...");
    
    let allFlipUsers = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      // Fetch users from the current page
      const flipUsersData = await getFlipUsers({
        sort: "LAST_NAME_ASC",
        page_limit: 100,
        page_number: currentPage,
      });

      if (!flipUsersData || !Array.isArray(flipUsersData.users)) {
        console.error("❌ Flip API response is invalid:", flipUsersData);
        throw new Error("Invalid response from Flip API (missing 'users')");
      }

      console.log(`✅ Fetched page ${currentPage}/${flipUsersData.pagination.total_pages}`);

      allFlipUsers.push(...flipUsersData.users);
      totalPages = flipUsersData.pagination.total_pages;
      currentPage++;
      
    } while (currentPage <= totalPages);

    // Convert FlipUser objects
    const flipUsers = allFlipUsers.map(user => new FlipUser(user));
    console.log(`✅ Fetched total ${flipUsers.length} Flip users. Processing...`);

    for (const flipUser of flipUsers) {
      if (flipUser.primary_user_group.id === "28c08fdc-ff27-4ada-a13f-463a771d402d") {
        continue;
      }

      let mitarbeiter = await Mitarbeiter.findOne({ flip_id: flipUser.id });

      if (!mitarbeiter) {
        mitarbeiter = await createMitarbeiterByFlip(flipUser);
        console.log(mitarbeiter._id.toString());
      }

      
        if(!mitarbeiter._id.equals(flipUser.external_id)){
          flipUser.setExternalId(mitarbeiter._id.toString());
          await flipUser.update();
        } 
      

      // Sync `isActive` field
      const shouldBeActive = flipUser.status === "ACTIVE";
      if (mitarbeiter.isActive !== shouldBeActive) {
        mitarbeiter.isActive = shouldBeActive;
        await mitarbeiter.save();
      }
    }

    console.log(`✅ Processed ${flipUsers.length} Flip users.`);
    return flipUsers;
  } catch (error) {
    console.error("❌ Error in Flip API user refresh:", error.message);
    throw new Error("Failed to fetch Flip users");
  }
}

async function createMitarbeiterByFlip(flipUser) {
  try {
    const mitarbeiterData = flipUser.toMitarbeiter();
    const newMitarbeiter = new Mitarbeiter(mitarbeiterData);
    await newMitarbeiter.save();
    console.log(`✅ Created new Mitarbeiter: ${flipUser.vorname} ${flipUser.nachname}`);
    return newMitarbeiter;
  } catch (error) {
    console.error("❌ Error creating Mitarbeiter:", error.message);
    throw new Error("Failed to create Mitarbeiter");
  }
}

async function createMitarbeiterByAsana(asanaKarte) {

}

async function getFlipUsers(params = {}) {

  try {
    const response = await flipAxios.get("/api/admin/users/v4/users", { params });
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching Flip users:", error.response?.data || error.message);
    throw new Error("Failed to fetch Flip users");
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
    const response = await flipAxios.get("/api/admin/users/v4/user-groups", { params });
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching Flip users:", error.response?.data || error.message);
    throw new Error("Failed to fetch Flip users");
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
  return assignFields(documentId, { teamleiter: teamleiterId }, async (document) => {
    if (document instanceof Laufzettel) {
      await document.populate("mitarbeiter teamleiter");

      const teamleiter = document.teamleiter;
      const mitarbeiter = document.mitarbeiter;

      if (!teamleiter || !mitarbeiter) {
        console.warn(`⚠ Missing required fields in Laufzettel: ${document._id}`);
        return;
      }

      try {
        const authToken = await getFlipAuthToken(); // 🔥 Use cached or fresh token

        await assignFlipTask({
          body: {
            external_id: document._id.toString(),
            title: `Laufzettel erhalten: ${mitarbeiter.vorname} ${mitarbeiter.nachname}`,
            recipients: [{
             id: teamleiter.flip_id,
             type: "USER"}],
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
  });
};
const assignMitarbeiter = async (documentId, mitarbeiterId) => {
  return assignFields(documentId, { mitarbeiter: mitarbeiterId });
};

async function assignFlipTask(req) {
  try {
    const { external_id, title, recipients, description } = req.body;
    if (!recipients || !Array.isArray(recipients)) {
      throw new Error("Invalid recipients: Must be an array with at least one recipient.");
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
      console.log("⚠️ Task with external_id already exists. Skipping creation.");
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

    console.log("✅ Flip Task Assigned Successfully:", createdTask.toSimplifiedObject());

    return createdTask.toSimplifiedObject();
  } catch (error) {
    console.error("❌ Error assigning Flip Task:", error.response ? error.response.data : error.message);
    throw new Error(error.response ? JSON.stringify(error.response.data) : error.message);
  }
}

module.exports = {
  flipUserRoutine,
  getFlipUsers,
  getFlipUserGroups,
  findFlipUserByName,
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignFlipTask,
};
