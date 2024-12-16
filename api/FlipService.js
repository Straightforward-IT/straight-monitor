const stringSimilarity = require("string-similarity");
const FlipUser = require("./models/FlipUser");

const findFlipUserByName = async (fullName) => {
    const users = await FlipUser.find();

    // Normalize the input name for comparison
    const normalizedInput = fullName.toLowerCase().replace(/\s+/g, "");

    // Create arrays of normalized user names
    const normalizedUsers = users.map((user) => ({
        id: user._id,
        fullName: `${user.vorname} ${user.nachname}`.toLowerCase().replace(/\s+/g, ""),
        vorname: user.vorname.toLowerCase(),
        nachname: user.nachname.toLowerCase(),
    }));

    const inputParts = fullName.toLowerCase().split(/\s+/); // Split input into words
    const inputLastName = inputParts[inputParts.length - 1]; // Assume last word is the last name
    const inputFirstNames = inputParts.slice(0, -1); // All other parts as first name(s)

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

module.exports = { findFlipUserByName };