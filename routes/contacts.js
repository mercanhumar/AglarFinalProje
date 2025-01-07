// routes/contacts.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.username;
    if (!searchQuery) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Find users matching the search query
    const users = await User.find({
      username: { $regex: searchQuery, $options: 'i' },
      _id: { $ne: req.user.id } // Exclude current user
    }).select('username _id isOnline lastSeen');

    res.json({ users });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});

// Get all contacts
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching contacts for user:', req.user.id);
    
    const user = await User.findById(req.user.id)
      .populate('contacts', 'username _id isOnline lastSeen');

    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ 
        status: 'error',
        message: 'User not found' 
      });
    }

    console.log('Found contacts:', user.contacts.length);
    res.json({ 
      status: 'success',
      contacts: user.contacts || [],
      message: 'Contacts retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching contacts',
      error: error.message 
    });
  }
});

// Add contact
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    console.log('Adding contact:', username, 'for user:', req.user.id);
    
    // Find the contact user
    const contactUser = await User.findOne({ username });
    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if trying to add self
    if (contactUser._id === req.user.id) {
      return res.status(400).json({ message: 'Cannot add yourself as a contact' });
    }

    // Get current user
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    // Check if already in contacts
    if (currentUser.contacts.includes(contactUser._id)) {
      return res.status(400).json({ message: 'User is already in your contacts' });
    }

    // Add to contacts
    currentUser.contacts.push(contactUser._id);
    await currentUser.save();

    res.json({ 
      message: 'Contact added successfully',
      contact: {
        _id: contactUser._id,
        username: contactUser.username,
        isOnline: contactUser.isOnline,
        lastSeen: contactUser.lastSeen
      }
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ message: 'Error adding contact' });
  }
});

// Delete contact
router.delete('/delete/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    
    // Get current user
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    // Remove contact
    const contactIndex = currentUser.contacts.indexOf(contactId);
    if (contactIndex === -1) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    currentUser.contacts.splice(contactIndex, 1);
    await currentUser.save();

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Error deleting contact' });
  }
});

module.exports = router;
