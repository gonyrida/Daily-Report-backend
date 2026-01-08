require("dotenv").config();
const app = require("./app");
const env = require("./config/env");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
