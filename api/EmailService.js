const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require("fs");
const path = require("path");
const Item = require("./models/Item");
const msal = require("@azure/msal-node");
const cron = require("node-cron");
require("dotenv").config();

// Read image file and convert to base64
const imagePath = path.join(__dirname, "assets", "Banner.png");
const base64Image = fs.readFileSync(imagePath).toString("base64");

// OAuth2 Configuration
const config = {
    auth: {
        clientId: process.env.EMAIL_CLIENT_ID,
        authority: process.env.EMAIL_AUTHORITY,
        clientSecret: process.env.EMAIL_SECRET,
    },
};

// Initialize MSAL client for OAuth2
const cca = new msal.ConfidentialClientApplication(config);

// Send Mail Function
async function sendMail(to, subject, content, from = "it@straightforward.email") {
    try {
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"],
        });

        const client = Client.init({
            authProvider: (done) => {
                done(null, authResponse.accessToken);
            },
        });

        const mail = {
            message: {
                subject,
                body: {
                    contentType: "HTML",
                    content: `${content}<br><img src="cid:bannerImage" alt="Banner Image" style="width: 280px; height: auto;" />`,
                },
                toRecipients: [{ emailAddress: { address: to } }],
                from: { emailAddress: { address: from } },
                attachments: [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        name: "Banner.png",
                        contentId: "bannerImage",
                        contentBytes: base64Image,
                    },
                ],
            },
        };

        await client.api(`/users/${from}/sendMail`).post(mail);
        console.log("Email sent successfully to:", to);
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

// Generate Email Content
function createRoutineContent(location) {
    const today = new Date().toLocaleDateString("de-DE");
    let content = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Bestands Update vom ${today} für Team ${location.name}</h2>
    `;

    const itemsWithSoll = location.items.filter((item) => item.soll > 0);
    const itemsWithZeroSoll = location.items.filter((item) => item.soll === 0);

    const sortedItems = itemsWithSoll.sort((a, b) => (b.anzahl / b.soll) - (a.anzahl / a.soll));

    if (sortedItems.length > 0) {
        content += `
            <h3>Items mit Soll</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align: left;">BEZEICHNUNG</th>
                        <th style="text-align: right;">IST</th>
                        <th style="text-align: right;">SOLL</th>
                        <th style="text-align: right;">PROZENT</th>
                    </tr>
                </thead>
                <tbody>
        `;
        sortedItems.forEach((item) => {
            const percentage = Math.round((item.anzahl / item.soll) * 100);
            const color = getPercentageColor(percentage);
            content += `
                <tr>
                   <td>${item.bezeichnung}${item.groesse !== 'onesize' ? ` ${item.groesse}` : ''}</td>
                    <td style="text-align: right;">${item.anzahl}</td>
                    <td style="text-align: right;">${item.soll}</td>
                    <td style="text-align: right; background-color: ${color};">${percentage}%</td>
                </tr>
            `;
        });
        content += `</tbody></table>`;
    }

    if (itemsWithZeroSoll.length > 0) {
        content += `
            <h3>Items ohne Soll</h3>
            <ul>
                ${itemsWithZeroSoll.map((item) => `<li>${item.bezeichnung}${item.groesse !== 'onesize' ? ` ${item.groesse}` : ''}: ${item.anzahl}</li>`).join("")}
            </ul>
        `;
    }

    content += `</div>`;
    return content;
}

// Helper to determine the color for percentage
function getPercentageColor(percentage) {
    if (percentage >= 75) return "#02b504";
    if (percentage >= 50) return "#47ff49";
    if (percentage >= 25) return "#ffd647";
    return "#fb2a2a";
}

// Fetch Items by Location
async function getItems(location) {
    try {
        return await Item.find({ standort: location });
    } catch (err) {
        console.error("Error fetching items for location:", location, err);
        return [];
    }
}

// Main Routine
async function sollRoutine() {
    const locations = [
        {
            name: "Hamburg",
            email: "teamhamburg@straightforward.email",
            weekdays: ["Monday"],
            enabled: true,
        },
        {
            name: "Berlin",
            email: "teamberlin@straightforward.email",
            weekdays: ["Monday"],
            enabled: false,
        },
        {
            name: "Köln",
            email: "teamkoeln@straightforward.email",
            weekdays: ["Monday"],
            enabled: false,
        }
    ];

    const today = new Date().toLocaleString("en-US", { weekday: "long" });

    for (const location of locations) {
        if (location.enabled && location.weekdays.includes(today)) {
            try {
                const items = await getItems(location.name);
                location.items = items;
                const content = createRoutineContent(location);
                await sendMail(
                    location.email,
                    `Bestands-Update vom ${new Date().toLocaleDateString("de-DE")} für Team ${location.name}`,
                    content
                );
            } catch (error) {
                console.error(`Error processing email for ${location.name}:`, error);
            }
        }
    }
}


module.exports = { sendMail, sollRoutine };
