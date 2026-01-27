const { v4: uuidv4 } = require('uuid');

// In-memory storage for demo purposes
// In production, this would be a database (MongoDB, PostgreSQL, etc.)
let feedbackData = [];

const createFeedback = async (feedbackData) => {
  try {
    const feedback = {
      id: uuidv4(),
      rating: feedbackData.rating,
      message: feedbackData.message,
      category: feedbackData.category,
      userId: feedbackData.userId,
      userEmail: feedbackData.userEmail,
      userAgent: feedbackData.userAgent,
      url: feedbackData.url,
      ipAddress: feedbackData.ipAddress,
      timestamp: feedbackData.timestamp
    };

    // Store feedback (in production, save to database)
    feedbackData.push(feedback);

    console.log('💬 Feedback created:', {
      id: feedback.id,
      rating: feedback.rating,
      category: feedback.category,
      userId: feedback.userId || 'anonymous',
      timestamp: feedback.timestamp
    });

    return feedback;

  } catch (error) {
    console.error('❌ Error creating feedback:', error);
    throw new Error('Failed to create feedback');
  }
};

const getFeedbackAnalytics = async () => {
  try {
    const totalFeedback = feedbackData.length;
    
    if (totalFeedback === 0) {
      return {
        total: 0,
        averageRating: 0,
        ratingDistribution: {},
        categoryDistribution: {},
        recentFeedback: []
      };
    }

    // Calculate rating distribution
    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = feedbackData.filter(f => f.rating === i).length;
    }

    // Calculate average rating
    const totalRating = feedbackData.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = (totalRating / totalFeedback).toFixed(2);

    // Calculate category distribution
    const categoryDistribution = {};
    feedbackData.forEach(feedback => {
      categoryDistribution[feedback.category] = (categoryDistribution[feedback.category] || 0) + 1;
    });

    // Get recent feedback (last 10)
    const recentFeedback = feedbackData
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(f => ({
        id: f.id,
        rating: f.rating,
        category: f.category,
        message: f.message.substring(0, 100) + (f.message.length > 100 ? '...' : ''),
        timestamp: f.timestamp,
        userId: f.userId
      }));

    return {
      total: totalFeedback,
      averageRating: parseFloat(averageRating),
      ratingDistribution,
      categoryDistribution,
      recentFeedback
    };

  } catch (error) {
    console.error('❌ Error getting feedback analytics:', error);
    throw new Error('Failed to retrieve feedback analytics');
  }
};

const getFeedbackList = async (filters = {}) => {
  try {
    let filteredFeedback = [...feedbackData];

    // Apply filters
    if (filters.rating) {
      filteredFeedback = filteredFeedback.filter(f => f.rating === filters.rating);
    }

    if (filters.category) {
      filteredFeedback = filteredFeedback.filter(f => f.category === filters.category);
    }

    // Sort by timestamp (newest first)
    filteredFeedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedFeedback = filteredFeedback.slice(startIndex, endIndex);

    return {
      feedback: paginatedFeedback,
      pagination: {
        page,
        limit,
        total: filteredFeedback.length,
        pages: Math.ceil(filteredFeedback.length / limit)
      }
    };

  } catch (error) {
    console.error('❌ Error getting feedback list:', error);
    throw new Error('Failed to retrieve feedback list');
  }
};

// Helper function to get feedback by user ID
const getFeedbackByUserId = async (userId) => {
  try {
    const userFeedback = feedbackData.filter(f => f.userId === userId);
    
    return userFeedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  } catch (error) {
    console.error('❌ Error getting feedback by user ID:', error);
    throw new Error('Failed to retrieve user feedback');
  }
};

// Delete old feedback data
const deleteOldFeedback = async (daysOld = 365) => {
  try {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const initialLength = feedbackData.length;
    feedbackData = feedbackData.filter(feedback => {
      const feedbackTime = new Date(feedback.timestamp).getTime();
      return feedbackTime > cutoffTime;
    });
    
    const deletedCount = initialLength - feedbackData.length;
    console.log(`🗑️ Deleted ${deletedCount} old feedback entries (older than ${daysOld} days)`);
    
    return deletedCount;

  } catch (error) {
    console.error('❌ Error deleting old feedback:', error);
    throw new Error('Failed to delete old feedback');
  }
};

// Initialize with some sample data for testing
const initializeSampleData = () => {
  if (feedbackData.length === 0) {
    const sampleFeedback = [
      {
        id: uuidv4(),
        rating: 5,
        message: "Great application! Very user-friendly and helpful.",
        category: "general",
        userId: 'sample-user-1',
        userEmail: 'user1@example.com',
        userAgent: 'Mozilla/5.0 (Sample)',
        url: 'https://example.com/settings',
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: uuidv4(),
        rating: 2,
        message: "The theme switching is confusing and doesn't work properly.",
        category: "ui",
        userId: 'sample-user-2',
        userEmail: 'user2@example.com',
        userAgent: 'Mozilla/5.0 (Sample)',
        url: 'https://example.com/settings',
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        id: uuidv4(),
        rating: 4,
        message: "Good overall, but would like to see more customization options.",
        category: "feature",
        userId: null,
        userEmail: null,
        userAgent: 'Mozilla/5.0 (Sample)',
        url: 'https://example.com/settings',
        ipAddress: '127.0.0.1',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ];

    feedbackData.push(...sampleFeedback);
    console.log('💬 Initialized sample feedback data');
  }
};

// Initialize sample data on module load
initializeSampleData();

module.exports = {
  createFeedback,
  getFeedbackAnalytics,
  getFeedbackList,
  getFeedbackByUserId,
  deleteOldFeedback,
  cleanupOldSessions,
  getActiveSessionCount
};
