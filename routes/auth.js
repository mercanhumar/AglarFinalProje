// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? 
          'Username already exists' : 
          'Email already exists' 
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();
    console.log('New user created:', user._id);

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    console.log('User found:', user ? 'yes' : 'no');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check password using the model's method
    const validPassword = await user.comparePassword(password);
    console.log('Password valid:', validPassword ? 'yes' : 'no');
    
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // Update user status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    console.log('Login successful for user:', username);

    // Send response with complete user data
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    console.log('Logout attempt for user:', req.user._id);

    // Update user status
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Search by username
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    const usersFound = await User.find({
      username: { $regex: username, $options: 'i' },
    }).select('username id _id');
    res.status(200).json(usersFound);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});

// Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User profile retrieved', user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Error retrieving user', error: error.message });
  }
});

// Profile by ID (to fetch username/email of a known ID)
router.get('/profileById', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }
    const user = await User.findById(userId).select('username email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('profileById error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search users
router.get('/contacts/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Find users whose username contains the query (case-insensitive)
    const users = await User.find({
      username: { $regex: query, $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    }).select('username isOnline');

    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});

// Add contact
router.post('/contacts/add', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    
    // Find user by username
    const userToAdd = await User.findOne({ username });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already in contacts
    const currentUser = await User.findById(req.user._id);
    if (currentUser.contacts.includes(userToAdd._id)) {
      return res.status(400).json({ message: 'User is already in your contacts' });
    }

    // Add to contacts
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { contacts: userToAdd._id } }
    );

    res.json({ message: 'Contact added successfully' });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ message: 'Error adding contact' });
  }
});

// Get contacts
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts', 'username isOnline');
    
    res.json({ contacts: user.contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

module.exports = router;
