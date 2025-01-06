// routes/contacts.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Get all contacts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('contacts', 'username _id');
    res.json({ contacts: user.contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

// Add contact
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    
    // Find contact user
    const contactUser = await User.findOne({ username });
    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already in contacts
    const currentUser = await User.findById(req.user.userId);
    if (currentUser.contacts.includes(contactUser._id)) {
      return res.status(400).json({ message: 'User already in contacts' });
    }

    // Add contact to both users
    currentUser.contacts.push(contactUser._id);
    await currentUser.save();

    contactUser.contacts.push(currentUser._id);
    await contactUser.save();

    res.status(201).json({ message: 'Contact added successfully' });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ message: 'Error adding contact' });
  }
});

// Remove contact
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    
    // Remove contact from both users
    await User.findByIdAndUpdate(req.user.userId, {
      $pull: { contacts: contactId }
    });

    await User.findByIdAndUpdate(contactId, {
      $pull: { contacts: req.user.userId }
    });

    res.json({ message: 'Contact removed successfully' });
  } catch (error) {
    console.error('Error removing contact:', error);
    res.status(500).json({ message: 'Error removing contact' });
  }
});

module.exports = router;
