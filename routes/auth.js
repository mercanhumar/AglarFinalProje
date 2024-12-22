const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User'); // This now should refer to the real User model
const authenticateToken = require('../controllers/authenticationToken');
const router = express.Router();


// Verify that the User model is loaded correctly
console.log('User model loaded:', User);

// Register route
router.post('/register', async (req, res) => {
  try {
    console.log('Register request received:', req.body);
    const { username, email, password } = req.body;

    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required',
        details: {
          username: !username ? 'Username is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
        },
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection error',
        details: 'MongoDB is not connected. Please ensure MongoDB is running.',
      });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email }, { username: username }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists',
        details: existingUser.email === email ? 'Email already registered' : 'Username already taken',
      });
    }

    // Create a new user and save it
    const newUser = new User({ username, email, password });
    await newUser.save();

    // Generate JWT token
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      console.log('Validation failed: Missing username or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`No user found with username: ${username}`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    console.log('User found in database:', user);

    // Compare passwords
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log(`Password comparison result for user "${username}":`, isValidPassword);

    if (!isValidPassword) {
      console.log(`Invalid password for user "${username}"`);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    console.log('Generating JWT token...');
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    console.log('Login successful for user:', username);
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const users = await User.find({ 
      username: { $regex: username, $options: 'i' } 
    }).select('username userId');

    res.status(200).json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const users = await User.find({ 
      username: { $regex: username, $options: 'i' } 
    }).select('username userId');

    res.status(200).json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});


// Protected profile route
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // req.user.userId is set by the authenticationToken middleware
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User profile retrieved successfully',
      user,
    });
  } catch (error) {
    console.error('Error retrieving user data:', error);
    res.status(500).json({ message: 'Error retrieving user data', error: error.message });
  }
});

module.exports = router;
