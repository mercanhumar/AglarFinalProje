<<<<<<< HEAD
// models/Message.js
=======
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
<<<<<<< HEAD
    required: false
  },
  senderId: {
    type: String, // user.userId
    required: true,
  },
  recipientId: {
    type: String, // user.userId
    required: true,
=======
    required: false // Not strictly required if you're not always using conversationId
  },
  senderId: {
    type: String,
    required: true
  },
  recipientId: {
    type: String,
    required: true
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
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
<<<<<<< HEAD
    enum: ['pending','sent','delivered','read'],
=======
    enum: ['sent', 'delivered', 'read'],
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
    default: 'sent',
  },
});

module.exports = mongoose.model('Message', messageSchema);
