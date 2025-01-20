const stringSimilarity = require("string-similarity");
const mongoose = require("mongoose");
const FlipUser = require("./models/FlipUser");
const { Laufzettel, EventReport, EvaluierungMA } = require("./models/FlipDocs");
const Mitarbeiter = require("./models/Mitarbeiter");

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

const assignFields = async (documentId, updates) => {
    try {
        const models = [Laufzettel, EventReport, EvaluierungMA];
        let documentFound = null;

        // Find the document in one of the models
        for (const model of models) {
            documentFound = await model.findById(documentId);
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
            documentFound.assigned = !!documentFound.teamleiter && !!documentFound.mitarbeiter;
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

        return documentFound;
    } catch (error) {
        throw new Error(`Error assigning fields: ${error.message}`);
    }
};


const assignTeamleiter = async (documentId, teamleiterId) => {
  return assignFields(documentId, { teamleiter: teamleiterId });
};

const assignMitarbeiter = async (documentId, mitarbeiterId) => {
  return assignFields(documentId, { mitarbeiter: mitarbeiterId });
};

const assignTeamleiterUndMitarbeiter = async (
  documentId,
  teamleiterId,
  mitarbeiterId
) => {
  return assignFields(documentId, {
    teamleiter: teamleiterId,
    mitarbeiter: mitarbeiterId,
  });
};

module.exports = {
  findFlipUserByName,
  findMitarbeiterByName,
  assignTeamleiter,
  assignMitarbeiter,
  assignTeamleiterUndMitarbeiter,
};
