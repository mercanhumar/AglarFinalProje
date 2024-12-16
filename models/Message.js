const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: false // Not strictly required if you're not always using conversationId
  },
  senderId: {
    type: String,
    required: true
  },
  recipientId: {
    type: String,
    required: true
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
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
});

module.exports = mongoose.model('Message', messageSchema);
