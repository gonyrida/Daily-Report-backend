const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
const dailyReportRoutes = require("./routes/dailyReportRoutes");
const authRoutes = require("./routes/authRoutes");
const imageRoutes = require("./routes/imageRoutes");
const projectRoutes = require("./routes/projectRoutes");
const supportRoutes = require("./routes/supportRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { authenticateToken } = require("./middleware/authMiddleware");
const { generalLimiter, authLimiter } = require("./middleware/rateLimitMiddleware");
const env = require("./config/env"); // Add this line

const app = express();

// Connect to MongoDB
connectDB();

// Serve static files from uploads directory with authentication
app.use('/uploads', authenticateToken, express.static(path.join(__dirname, 'uploads')));

// Apply general rate limiting to all requests
app.use(generalLimiter);

// Middleware - CORS should be before other middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "https://a.cambodiacpm.com",
        "https://api.cambodiacpm.com",
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
app.use("/api/images", authenticateToken, imageRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/notifications", authenticateToken, notificationRoutes);

// Health check route
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check database connection and latency
    const mongoose = require('mongoose');
    let dbStatus = 'disconnected';
    let dbLatency = null;
    let dbHost = null;
    
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';
    
    // Test database latency if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const dbStart = Date.now();
        await mongoose.connection.db.admin().ping();
        dbLatency = `${Date.now() - dbStart}ms`;
        dbHost = mongoose.connection.host;
      } catch (pingError) {
        dbLatency = 'failed';
        dbStatus = 'degraded';
      }
    }
    
    // Check memory usage and calculate percentages
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memLimitMB = Math.round((memUsage.heapLimit || 1024 * 1024 * 1024) / 1024 / 1024); // Fallback to 1GB
    const memUsagePercent = memTotalMB > 0 ? Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) : 0;
    const memUsageOfLimitPercent = memLimitMB > 0 ? Math.round((memUsage.heapUsed / (memLimitMB * 1024 * 1024)) * 100) : 0;
    
    // Get system memory info
    const os = require('os');
    const systemMem = os.totalmem();
    const freeMem = os.freemem();
    const systemTotalGB = Math.round(systemMem / 1024 / 1024 / 1024);
    const systemFreeGB = Math.round(freeMem / 1024 / 1024 / 1024);
    const systemUsedGB = systemTotalGB - systemFreeGB;
    
    // Calculate uptime
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    
    const responseTime = Date.now() - startTime;
    
    // Determine overall health status
    let overallStatus = 'healthy';
    let httpStatus = 200;
    
    // Health thresholds
    if (dbStatus === 'disconnected' || dbStatus === 'error') {
      overallStatus = 'unhealthy';
      httpStatus = 503;
    } else if (dbStatus === 'connecting' || dbStatus === 'disconnecting' || dbLatency === 'failed') {
      overallStatus = 'degraded';
      httpStatus = 503;
    } else if (memUsagePercent > 90) {
      overallStatus = 'degraded';
      httpStatus = 503;
    } else if (responseTime > 1000) {
      overallStatus = 'degraded';
      httpStatus = 503;
    }
    
    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: uptimeFormatted,
      services: {
        database: {
          status: dbStatus,
          host: dbHost,
          latency: dbLatency,
          type: 'MongoDB'
        },
        api: {
          status: 'running',
          version: process.env.npm_package_version || '1.0.0',
          environment: env.NODE_ENV || 'development'
        }
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCores: os.cpus().length,
        memory: {
          heap: {
            used: `${memUsedMB}MB`,
            total: `${memTotalMB}MB`,
            limit: `${memLimitMB}MB`,
            usagePercent: `${memUsagePercent}%`,
            usageOfLimit: `${memUsageOfLimitPercent}%`
          },
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
          system: {
            total: `${systemTotalGB}GB`,
            free: `${systemFreeGB}GB`,
            used: `${systemUsedGB}GB`
          }
        }
      },
      thresholds: {
        maxResponseTime: '1000ms',
        maxMemoryUsage: '90%',
        criticalServices: ['database']
      }
    };
    
    res.status(httpStatus).json(healthResponse);
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: { status: 'error' },
        api: { status: 'error' }
      }
    });
  }
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
