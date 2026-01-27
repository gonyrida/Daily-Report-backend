const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// In-memory storage for demo purposes
// In production, this would be a database (MongoDB, PostgreSQL, etc.)
let supportTickets = [];

const createSupportTicket = async (ticketData) => {
  try {
    const ticket = {
      ticketId: `TCK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      userId: ticketData.userId,
      subject: ticketData.subject,
      category: ticketData.category,
      message: ticketData.message,
      priority: ticketData.priority,
      status: 'open',
      attachment: ticketData.attachment,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store ticket (in production, save to database)
    supportTickets.push(ticket);

    console.log('📝 Support ticket created:', {
      ticketId: ticket.ticketId,
      userId: ticket.userId,
      category: ticket.category,
      priority: ticket.priority
    });

    return ticket;

  } catch (error) {
    console.error('❌ Error creating support ticket:', error);
    throw new Error('Failed to create support ticket');
  }
};

const getUserTickets = async (userId) => {
  try {
    // Filter tickets for the specific user
    const userTickets = supportTickets.filter(ticket => ticket.userId === userId);
    
    // Return tickets sorted by creation date (newest first)
    return userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  } catch (error) {
    console.error('❌ Error getting user tickets:', error);
    throw new Error('Failed to retrieve user tickets');
  }
};

const getTicketById = async (ticketId, userId) => {
  try {
    const ticket = supportTickets.find(t => t.ticketId === ticketId && t.userId === userId);
    
    if (!ticket) {
      return null;
    }

    return ticket;

  } catch (error) {
    console.error('❌ Error getting ticket by ID:', error);
    throw new Error('Failed to retrieve ticket');
  }
};

const updateTicketStatus = async (ticketId, status, userId = null) => {
  try {
    const ticketIndex = supportTickets.findIndex(t => 
      t.ticketId === ticketId && (!userId || t.userId === userId)
    );

    if (ticketIndex === -1) {
      throw new Error('Ticket not found');
    }

    supportTickets[ticketIndex].status = status;
    supportTickets[ticketIndex].updatedAt = new Date();

    return supportTickets[ticketIndex];

  } catch (error) {
    console.error('❌ Error updating ticket status:', error);
    throw new Error('Failed to update ticket status');
  }
};

const getAllTickets = async (filters = {}) => {
  try {
    let filteredTickets = [...supportTickets];

    // Apply filters
    if (filters.status) {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === filters.status);
    }

    if (filters.category) {
      filteredTickets = filteredTickets.filter(ticket => ticket.category === filters.category);
    }

    if (filters.priority) {
      filteredTickets = filteredTickets.filter(ticket => ticket.priority === filters.priority);
    }

    // Sort by creation date (newest first)
    return filteredTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  } catch (error) {
    console.error('❌ Error getting all tickets:', error);
    throw new Error('Failed to retrieve tickets');
  }
};

// Helper function to clean up old attachments (for maintenance)
const cleanupOldAttachments = async (daysOld = 30) => {
  try {
    const uploadDir = path.join(__dirname, '../../uploads/support');
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    if (!fs.existsSync(uploadDir)) {
      return;
    }

    const files = fs.readdirSync(uploadDir);
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Deleted old attachment:', file);
      }
    }

  } catch (error) {
    console.error('❌ Error cleaning up old attachments:', error);
  }
};

// Initialize with some sample data for testing
const initializeSampleData = () => {
  if (supportTickets.length === 0) {
    const sampleTickets = [
      {
        ticketId: 'TCK-SAMPLE-001',
        userId: 'sample-user-1',
        subject: 'Sample Technical Issue',
        category: 'technical',
        message: 'This is a sample technical issue for testing purposes.',
        priority: 'medium',
        status: 'resolved',
        attachment: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
      },
      {
        ticketId: 'TCK-SAMPLE-002',
        userId: 'sample-user-2',
        subject: 'Sample Account Problem',
        category: 'account',
        message: 'This is a sample account issue for testing purposes.',
        priority: 'high',
        status: 'open',
        attachment: null,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];

    supportTickets.push(...sampleTickets);
    console.log('📝 Initialized sample support tickets');
  }
};

// Initialize sample data on module load
initializeSampleData();

// Delete old support tickets
const deleteOldSupportTickets = async (daysOld = 730) => {
  try {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const initialLength = supportTickets.length;
    supportTickets = supportTickets.filter(ticket => {
      const ticketTime = new Date(ticket.createdAt).getTime();
      return ticketTime > cutoffTime;
    });
    
    const deletedCount = initialLength - supportTickets.length;
    console.log(`🗑️ Deleted ${deletedCount} old support tickets (older than ${daysOld} days)`);
    
    return deletedCount;

  } catch (error) {
    console.error('❌ Error deleting old support tickets:', error);
    throw new Error('Failed to delete old support tickets');
  }
};

module.exports = {
  createSupportTicket,
  getUserTickets,
  getTicketById,
  updateTicketStatus,
  getAllTickets,
  cleanupOldAttachments,
  deleteOldSupportTickets
};
