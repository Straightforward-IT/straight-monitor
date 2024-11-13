const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs = require('fs');
const path = require('path');
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

module.exports = { sendMail };
