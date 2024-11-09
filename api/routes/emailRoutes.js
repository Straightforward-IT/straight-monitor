const express = require("express");
const router = express.Router();
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const msal = require("@azure/msal-node");
require('dotenv').config();

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

// Configure the Graph Client with access token
async function sendMail() {
    try {
        // Acquire Token by Client Credential flow
        const authResponse = await cca.acquireTokenByClientCredential({
            scopes: ["https://graph.microsoft.com/.default"]
        });

        // Initialize Graph Client
        const client = Client.init({
            authProvider: (done) => {
                done(null, authResponse.accessToken); // Pass the access token to Graph API
            }
        });

        // Email configuration
        const mail = {
            message: {
                subject: "Test Email from shared mailbox",
                body: {
                    contentType: "Text",
                    content: "This is a test email sent from a shared mailbox using Microsoft Graph API."
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: "cb@straightforward.email"
                        }
                    }
                ],
                from: {
                    emailAddress: {
                        address: "it@straightforward.email" // Use shared mailbox address
                    }
                }
            }
        };

        // Send Email from the shared mailbox
        await client.api("/users/cb@straightforward.email/sendMail").post(mail);
        console.log("Email sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// Route to trigger the email
router.get("/", async (req, res) => {
    try {
        await sendMail();
        res.status(200).json({ msg: "Email sent successfully" });
    } catch (error) {
        res.status(500).json({ msg: "Failed to send email", error: error.message });
    }
});

module.exports = router;
