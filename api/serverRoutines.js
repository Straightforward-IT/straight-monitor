const cron = require("node-cron");
const { getFlipAuthToken } = require("./flipAxios"); 
const { flipUserRoutine } = require("./FlipService");
const { sollRoutine, sendMail } = require("./EmailService"); 
const { bewerberRoutine } = require("./AsanaService");

(async () => {
  try {
    // 🔄 Flip API token refresh at midnight
    cron.schedule("0 0 * * *", async () => {
      try {
        console.log("🔄 Running daily Flip API token refresh...");
        await getFlipAuthToken();
      } catch (error) {
        console.error("❌ Error in Flip API token refresh:", error.message);
        await sendMail("it@straightforward.email", "❌ Flip API Token Refresh Failed", `
          <h3>Error in Flip API Token Refresh</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        `);
      }
    });

    // 🔄 Flip Routine to refresh Mitarbeiter Database with Flip API
    cron.schedule("0 0 * * *", async () => {
      try {
        console.log("🔄 Running daily Flip API user refresh...");
        await flipUserRoutine();
      } catch (error) {
        console.error("❌ Error in Flip API user refresh:", error.message);
        await sendMail("it@straightforward.email", "❌ Flip User Routine Failed", `
          <h3>Error in Flip User Routine</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        `);
      }
    });

    // 🔄 Asana API Task Routine (every hour)
    cron.schedule("0 * * * *", async () => {
      try {
        console.log("🔄 Running Asana API Task Routine...");
        await bewerberRoutine();
      } catch (error) {
        console.error("❌ Error in Asana API Task Routine:", error.message);
        await sendMail("it@straightforward.email", "❌ Asana API Task Routine Failed", `
          <h3>Error in Asana API Task Routine</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        `);
      }
    });

    // 📧 Email routine at 8 AM
    cron.schedule("0 8 * * *", async () => {
      try {
        console.log("📧 Running scheduled email routine...");
        await sollRoutine();
      } catch (error) {
        console.error("❌ Error in scheduled email routine:", error.message);
        await sendMail("it@straightforward.email", "❌ Scheduled Email Routine Failed", `
          <h3>Error in Scheduled Email Routine</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre>${error.stack}</pre>
        `);
      }
    });

  } catch (error) {
    console.error("❌ Critical error in routine initialization:", error.message);
    await sendMail("it@straightforward.email", "❌ Critical Server Error", `
      <h3>Critical Server Error</h3>
      <p><strong>Error:</strong> ${error.message}</p>
      <pre>${error.stack}</pre>
    `);
  }
})();
