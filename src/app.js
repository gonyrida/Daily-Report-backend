const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
const dailyReportRoutes = require("./routes/dailyReportRoutes");
const authRoutes = require("./routes/authRoutes");
const imageRoutes = require("./routes/imageRoutes");
const projectRoutes = require("./routes/projectRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const { generalLimiter, authLimiter } = require("./middleware/rateLimitMiddleware");
const env = require("./config/env"); // Add this line

const app = express();

// Connect to MongoDB
connectDB();

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Middleware - CORS should be before other middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "https://daily-report-frontend-s4tq.onrender.com",
        "http://localhost:8080",
        "http://10.10.20.122:8080", // Added for current development setup
        "http://localhost:3000", // In case frontend runs on different port
        "http://localhost:5173", // Vite dev server default
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://10.10.20.122:5001",
      ];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Add cookie parser middleware BEFORE routes
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Serve static files from uploads directory with authentication and authorization
app.use(
  "/uploads",
  authenticateToken,
  (req, res, next) => {
    // Extract userId from path: /uploads/images/{userId}/{filename}
    const pathParts = req.path.split('/').filter(part => part);
    if (pathParts.length >= 2 && pathParts[0] === 'images') {
      const requestedUserId = pathParts[1];
      
      // SECURITY: Verify user can only access their own files
      if (requestedUserId !== req.user.userId) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied: You can only access your own files' 
        });
      }
    }
    next();
  },
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res, filePath) => {
      // Set CORS headers for images
      res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Routes - ALL protected with authentication and rate limiting
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/refresh-token", authLimiter, require("./routes/refreshTokenRoutes"));
app.use("/api/daily-reports", authenticateToken, dailyReportRoutes);
app.use("/api/projects", authenticateToken, projectRoutes);
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
