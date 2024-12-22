// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [
    {
      type: String, // userId or username
      required: true,
    },
  ],
  name: String,
  type: {
    type: String,
    default: 'private', // 'private' or 'group'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Conversation', conversationSchema);
