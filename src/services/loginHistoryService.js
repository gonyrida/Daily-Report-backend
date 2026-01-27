const { v4: uuidv4 } = require('uuid');
const geoip = require('geoip-lite'); // For IP geolocation
const UAParser = require('ua-parser-js'); // For user agent parsing

// In-memory storage for demo purposes
// In production, this would be a database (MongoDB, PostgreSQL, etc.)
let loginSessions = [];

// Helper function to parse user agent
const parseUserAgent = (userAgent) => {
  try {
    console.log('🔍 Parsing User Agent:', userAgent);
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    console.log('📱 UAParser Result:', {
      browser: result.browser,
      os: result.os,
      device: result.device,
      engine: result.engine,
      cpu: result.cpu
    });
    
    // Better device type detection
    let deviceType = 'desktop';
    let deviceName = 'Desktop';
    
    if (result.device.type) {
      deviceType = result.device.type;
      deviceName = result.device.vendor ? `${result.device.vendor} ${result.device.model}` : result.device.type;
    } else {
      // Check for mobile indicators in user agent
      const mobileIndicators = ['Mobile', 'Android', 'iPhone', 'iPad', 'Tablet', 'Mobi'];
      const isMobile = mobileIndicators.some(indicator => userAgent.includes(indicator));
      
      if (isMobile) {
        deviceType = 'mobile';
        deviceName = 'Mobile Device';
      } else {
        // Check for tablet indicators
        const tabletIndicators = ['iPad', 'Tablet'];
        const isTablet = tabletIndicators.some(indicator => userAgent.includes(indicator));
        
        if (isTablet) {
          deviceType = 'tablet';
          deviceName = 'Tablet';
        }
      }
    }
    
    // Better OS detection - handle Windows 11 and other modern OS
    let osName = result.os.name || 'Unknown';
    let osVersion = result.os.version || '';
    
    // Fix Windows 11 detection (many parsers still show Windows 10 for Win11)
    if (userAgent.includes('Windows NT 10.0') && userAgent.includes('rv:')) {
      // Check for Windows 11 indicators
      if (userAgent.includes('Edg/') || userAgent.includes('Chrome/') && userAgent.includes('144.')) {
        osName = 'Windows';
        osVersion = '11';
      }
    }
    
    // Additional OS fixes
    if (osName === 'Windows' && osVersion === '10.0' && userAgent.includes('rv:')) {
      // Might be Windows 11, check for recent browser versions
      const chromeMatch = userAgent.match(/Chrome\/(\d+)\./);
      if (chromeMatch && parseInt(chromeMatch[1]) >= 100) {
        osVersion = '11'; // Likely Windows 11
      }
    }
    
    const parsed = {
      browser: `${result.browser.name} ${result.browser.version}`,
      os: `${osName} ${osVersion}`,
      device: deviceName,
      deviceType: deviceType
    };
    
    console.log('✅ Final Parsed Device:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error parsing user agent:', error);
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Desktop',
      deviceType: 'desktop'
    };
  }
};

// Helper function to get location from IP
const getLocationFromIP = (ip) => {
  try {
    // Skip localhost and private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'Local Network';
    }
    
    const geo = geoip.lookup(ip);
    if (geo) {
      return `${geo.city}, ${geo.country}`;
    }
    
    return 'Unknown Location';
  } catch (error) {
    console.error('Error getting location from IP:', error);
    return 'Unknown Location';
  }
};

// Helper function to get device display name
const getDeviceDisplayName = (browser, os, deviceType) => {
  return `${browser} on ${os}`;
};

// Create login session when user logs in
const createLoginSession = async (userId, req, token) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
    
    const parsedUA = parseUserAgent(userAgent);
    const location = getLocationFromIP(ipAddress);
    
    const session = {
      id: uuidv4(),
      userId: userId,
      token: token,
      device: getDeviceDisplayName(parsedUA.browser, parsedUA.os, parsedUA.deviceType),
      deviceType: parsedUA.deviceType,
      browser: parsedUA.browser,
      os: parsedUA.os,
      location: location,
      ipAddress: ipAddress,
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isActive: true,
      userAgent: userAgent
    };

    // Store session
    loginSessions.push(session);

    console.log('🔐 Login session created:', {
      sessionId: session.id,
      userId,
      device: session.device,
      location: session.location
    });

    return session;

  } catch (error) {
    console.error('❌ Error creating login session:', error);
    throw new Error('Failed to create login session');
  }
};

// Get user's login history with pagination
const getUserLoginHistory = async (userId, page = 1, limit = 10) => {
  try {
    // Filter sessions for the specific user
    const userSessions = loginSessions.filter(session => session.userId === userId);
    
    // Sort by login time (newest first)
    userSessions.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSessions = userSessions.slice(startIndex, endIndex);
    
    // Mark current session (this would need token comparison in production)
    const sessionsWithCurrent = paginatedSessions.map(session => ({
      ...session,
      isCurrentSession: session.isActive // Simplified for demo
    }));

    return {
      sessions: sessionsWithCurrent,
      pagination: {
        page,
        limit,
        total: userSessions.length,
        pages: Math.ceil(userSessions.length / limit)
      }
    };

  } catch (error) {
    console.error('❌ Error getting user login history:', error);
    throw new Error('Failed to retrieve login history');
  }
};

// Deactivate a specific session by token
const deactivateSession = async (token) => {
  try {
    const sessionIndex = loginSessions.findIndex(s => s.token === token && s.isActive);

    if (sessionIndex === -1) {
      console.log('Session not found for deactivation:', token.substring(0, 10) + '...');
      return false;
    }

    loginSessions[sessionIndex].isActive = false;
    loginSessions[sessionIndex].revokedAt = new Date().toISOString();

    console.log('🚫 Session deactivated:', {
      sessionId: loginSessions[sessionIndex].id,
      userId: loginSessions[sessionIndex].userId
    });

    return true;

  } catch (error) {
    console.error('❌ Error deactivating session:', error);
    throw new Error('Failed to deactivate session');
  }
};

// Revoke a specific session
const revokeSession = async (userId, sessionId) => {
  try {
    const sessionIndex = loginSessions.findIndex(s => 
      s.userId === userId && s.id === sessionId
    );

    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    loginSessions[sessionIndex].isActive = false;
    loginSessions[sessionIndex].revokedAt = new Date().toISOString();

    console.log('🚫 Session revoked:', {
      sessionId,
      userId
    });

    return true;

  } catch (error) {
    console.error('❌ Error revoking session:', error);
    throw new Error('Failed to revoke session');
  }
};

// Revoke all other sessions except current
const revokeAllOtherSessions = async (userId, currentToken) => {
  try {
    let revokedCount = 0;
    
    loginSessions.forEach(session => {
      if (session.userId === userId && session.token !== currentToken && session.isActive) {
        session.isActive = false;
        session.revokedAt = new Date().toISOString();
        revokedCount++;
      }
    });

    console.log('🚫 Revoked all other sessions:', {
      userId,
      revokedCount
    });

    return revokedCount;

  } catch (error) {
    console.error('❌ Error revoking all other sessions:', error);
    throw new Error('Failed to revoke sessions');
  }
};

// Update session last active time
const updateSessionActivity = async (token) => {
  try {
    const session = loginSessions.find(s => s.token === token && s.isActive);
    
    if (session) {
      session.lastActive = new Date().toISOString();
    }

    return session;

  } catch (error) {
    console.error('❌ Error updating session activity:', error);
    return null;
  }
};

// Clean up old inactive sessions
const cleanupOldSessions = async (daysOld = 30) => {
  try {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const initialLength = loginSessions.length;
    loginSessions = loginSessions.filter(session => {
      const sessionTime = new Date(session.loginTime).getTime();
      return sessionTime > cutoffTime;
    });
    
    const deletedCount = initialLength - loginSessions.length;
    console.log(`🗑️ Cleaned up ${deletedCount} old login sessions (older than ${daysOld} days)`);
    
    return deletedCount;

  } catch (error) {
    console.error('❌ Error cleaning up old sessions:', error);
    throw new Error('Failed to cleanup old sessions');
  }
};

// Get active sessions count for a user
const getActiveSessionCount = async (userId) => {
  try {
    const activeSessions = loginSessions.filter(session => 
      session.userId === userId && session.isActive
    );
    
    return activeSessions.length;

  } catch (error) {
    console.error('❌ Error getting active session count:', error);
    return 0;
  }
};

// Initialize with sample data for testing (DISABLED for production)
const initializeSampleData = () => {
  // Sample data disabled - only real sessions will be tracked
  console.log('🔐 Login history service initialized (sample data disabled)');
};

// Initialize sample data on module load
initializeSampleData();

module.exports = {
  createLoginSession,
  getUserLoginHistory,
  deactivateSession,
  revokeSession,
  revokeAllOtherSessions,
  updateSessionActivity,
  cleanupOldSessions,
  getActiveSessionCount
};
