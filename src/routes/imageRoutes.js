const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  upload,
  uploadImage,
  uploadMultipleImages,
} = require("../controllers/imageController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 10 files.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Error uploading file",
    });
  }
  next();
};

// Upload single image
router.post(
  "/upload",
  authenticateToken,
  upload.single("image"),
  handleMulterError,
  uploadImage
);

// Upload multiple images
router.post(
  "/upload-multiple",
  authenticateToken,
  upload.array("images", 10), // Max 10 images
  handleMulterError,
  uploadMultipleImages
);

module.exports = router;

