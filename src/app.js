const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const dailyReportRoutes = require("./routes/dailyReportRoutes");
const authRoutes = require("./routes/authRoutes");
const imageRoutes = require("./routes/imageRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const env = require("./config/env"); // Add this line

const app = express();

// Connect to MongoDB
connectDB();

// Middleware - CORS should be before other middleware
app.use(
  cors({
    origin: "https://daily-report-frontend-s4tq.onrender.com",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res, filePath) => {
      // Set CORS headers for images
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/daily-reports", authenticateToken, dailyReportRoutes);
app.use("/api/images", imageRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something broke!",
    error: env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// After your route definitions, add:
// app.use("/api/auth", authRoutes);
// app.use("/api/daily-reports", dailyReportRoutes);

// Add this debugging route temporarily
app.get("/api/test", (req, res) => {
  res.json({ message: "Routes are working!" });
});

// List all registered routes (for debugging)
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`Route: ${Object.keys(r.route.methods)} ${r.route.path}`);
  }
});

module.exports = app;
