require("dotenv").config();
const app = require("./app");
const env = require("./config/env");
const cleanupScheduler = require("./utils/cleanupScheduler");

const PORT = process.env.PORT || 5000;

// Start the cleanup scheduler
cleanupScheduler.start();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`🕐 Cleanup scheduler started - Daily: 2:00 AM UTC, Weekly: Sundays 3:00 AM UTC`);
});
