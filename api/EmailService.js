const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require('fs');
const path = require('path');
const Item = require("./models/Item");
const msal = require("@azure/msal-node");
require('dotenv').config();

// Read image file and convert to base64
const imagePath = path.join(__dirname, 'assets', 'Banner.png');
const base64Image = fs.readFileSync(imagePath).toString('base64');

// OAuth2 Configuration
const config = {
    auth: {
        clientId: process.env.EMAIL_CLIENT_ID,
        authority: process.env.EMAIL_AUTHORITY,
        clientSecret: process.env.EMAIL_SECRET
    }
};


// Initialize MSAL client for OAuth2
const cca = new msal.ConfidentialClientApplication(config);

async function sendMail(to, subject, content, from = "it@straightforward.email") {
    try {
        // Acquire Token by Client Credential flow
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"]
        });

        // Initialize Graph Client
        const client = Client.init({
            authProvider: (done) => {
                done(null, authResponse.accessToken);
            }
        });

        // Email configuration with the image attachment
        const mail = {
            message: {
                subject: subject,
                body: {
                    contentType: "HTML",
                    content: `${content}<br><img src="cid:bannerImage" alt="Banner Image" style="width: 280px; height: auto;" />`
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: to
                        }
                    }
                ],
                from: {
                    emailAddress: {
                        address: from
                    }
                },
                attachments: [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        name: "Banner.png",
                        contentId: "bannerImage", // This must match the cid in the HTML content
                        contentBytes: base64Image
                    }
                ]
            }
        };

        // Send Email
        await client.api(`/users/${from}/sendMail`).post(mail);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

function createRoutineContent(location) {
    let content = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Bestands Update vom ${new Date().toLocaleDateString("de-DE")} für Team ${location.name}</h2>
    `;

    // Separate items with `soll = 0`
    const itemsWithSoll = location.items.filter(item => item.soll > 0);
    const itemsWithZeroSoll = location.items.filter(item => item.soll === 0);

    // Sort items with `soll > 0` by percentage in descending order
    const sortedItemsWithSoll = itemsWithSoll.sort((a, b) => {
        const percentageA = (a.anzahl / a.soll) * 100;
        const percentageB = (b.anzahl / b.soll) * 100;
        return percentageB - percentageA; // Descending order
    });

    // Add a table for items with `soll > 0`
    if (sortedItemsWithSoll.length > 0) {
        content += `
            <h3 style="margin-top: 20px; color: #333;">Items mit Soll</h3>
            <table style="width: 40%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                <thead>
                    <tr>
                        <th style="text-align: left; border-bottom: 2px solid #ddd; padding: 8px;">BEZEICHNUNG</th>
                        <th style="text-align: right; border-bottom: 2px solid #ddd; padding: 8px;">IST</th>
                        <th style="text-align: left; border-bottom: 2px solid #ddd; padding: 8px;">SOLL</th>
                        <th style="text-align: right; border-bottom: 2px solid #ddd; padding: 8px;">PROZENT</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedItemsWithSoll.forEach(item => {
            const percentage = Math.round((item.anzahl / item.soll) * 100);
            const color = getPercentageColor(percentage);

            content += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.bezeichnung}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${item.anzahl}</td>
                    <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${item.soll}</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd; background-color: ${color} ">${percentage}%</td>
                </tr>
            `;
        });

        content += `
                </tbody>
            </table>
        `;
    }

    // Add a separate section for items with `soll = 0`
    if (itemsWithZeroSoll.length > 0) {
        content += `
            <h3 style="margin-top: 20px; color: #555;">Items ohne 'Soll'</h3>
            <table style="width: 40%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                <thead>
                    <tr>
                        <th style="text-align: left; border-bottom: 2px solid #ddd; padding: 8px;">Name</th>
                        <th style="text-align: right; border-bottom: 2px solid #ddd; padding: 8px;">Anzahl</th>
                    </tr>
                </thead>
                <tbody>
        `;

        itemsWithZeroSoll.forEach(item => {
            const color = "#0074e4"; // Fixed color for "soll = 0"

            content += `
                <tr>
                    <td style="padding: 8px;">${item.bezeichnung}</td>
                    <td style="padding: 8px; text-align: right;">${item.anzahl}</td>
                </tr>
            `;
        });

        content += `
                </tbody>
            </table>
        `;
    }

    content += "</div>";
    return content;
}


// Helper function to determine the color based on the percentage
function getPercentageColor(percentage) {
    if (percentage >= 75) return "#02b504";
    if (percentage >= 50) return "#47ff49";
    if (percentage >= 25) return "#ffd647";
    return "#fb2a2a";
}


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
            name: "Koeln",
            email: "teamkoeln@straightforward.email",
            weekdays: ["Monday"],
            enabled: false,
        }
    ];

    for (const location of locations) {
        if (location.enabled) {
            try {
                const items = await getItems(location.name); // Fetch items asynchronously
                location.items = items; // Add items to the location
                const content = createRoutineContent(location); // Generate email content
                await sendMail(
                    location.email,
                    `Bestands-Update vom ${new Date().toLocaleDateString("de-DE")} für Team ${location.name}`,
                    content
                );
                console.log(`Email sent successfully to ${location.email}`);
            } catch (err) {
                console.error(`Error sending email to ${location.name}:`, err);
            }
        }
    }
}

async function getItems(location) {
    try {
        const items = await Item.find({ standort: location });
        return items;
    } catch (err) {
        console.error(`Error fetching items for location ${location}:`, err);
        return []; // Return an empty array on error to avoid breaking further processing
    }
}


module.exports = { sendMail, sollRoutine };
