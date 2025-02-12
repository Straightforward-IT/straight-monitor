const cron = require("node-cron");
const { getFlipAuthToken } = require("./flipAxios"); 
const { flipUserRoutine } = require("./FlipService");
const { sollRoutine } = require("./EmailService"); 

(async () => {
  try {
    // 🔄 Flip API token refresh at midnight
    cron.schedule("0 0 * * *", async () => {
      try {
        console.log("🔄 Running daily Flip API token refresh...");
        await getFlipAuthToken();
      } catch (error) {
       //EmailService Error handling
      }
    });

    // 🔄 Flip Routine to refresh Mitarbeiter Database with Flip API
    cron.schedule("0 0 * * *", async () => {
      try {
        console.log("🔄 Running daily Flip API user refresh...");
        await flipUserRoutine();
      } catch (error) {
        //EmailService Error handling
      }
    });
    cron.schedule("0 * * * *", async () => {
      try{
        console.log("🔄 Running Asana API Task Routine...");
        // await asanaRoutine();
      } catch(error) {
        //EmailService Error handling
      }
    });
    // 📧 Email routine at 8 AM
    cron.schedule("0 8 * * *", async () => {
      try {
        console.log("📧 Running scheduled email routine...");
        await sollRoutine();
      } catch (error) {
       //EmailService Error handling
      }
    });

  } catch (error) {
   //EmailService Error handling
  }
})();