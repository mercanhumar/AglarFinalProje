const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT tokens and handle user authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        status: 'error',
        message: 'No token provided' 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);

      const user = await User.findById(decoded.id);
      console.log('Found user:', user ? user._id : 'not found');
      
      if (!user) {
        return res.status(401).json({ 
          status: 'error',
          message: 'User not found' 
        });
      }

      // Store full user object
      req.user = user;
      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(500).json({ 
      status: 'error',
      message: 'Authentication failed' 
    });
  }
}

/**
 * Middleware to check if user has admin privileges
 */
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ 
      status: 'error',
      message: 'Admin privileges required' 
    });
  }
  next();
}

/**
 * Middleware to check if user owns the resource
 * @param {string} userIdField - Field name in request params containing user ID
 */
function requireOwnership(userIdField) {
  return async (req, res, next) => {
    try {
      const resourceUserId = req.params[userIdField];
      if (req.user._id !== resourceUserId) {
        return res.status(403).json({ 
          status: 'error',
          message: 'Access denied' 
        });
      }
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Error checking resource ownership' 
      });
    }
  };
}

/**
 * Middleware to validate API key for external services
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      status: 'error',
      message: 'Invalid API key' 
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireOwnership,
  validateApiKey
};
