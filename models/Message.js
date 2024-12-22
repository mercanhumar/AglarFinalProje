// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: false
  },
  senderId: {
    type: String, // user.userId
    required: true,
  },
  recipientId: {
    type: String, // user.userId
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending','sent','delivered','read'],
    default: 'sent',
  },
});

module.exports = mongoose.model('Message', messageSchema);
