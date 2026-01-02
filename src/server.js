require("dotenv").config();
const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
