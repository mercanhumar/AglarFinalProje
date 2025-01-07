// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  }
}, { 
  timestamps: true 
});

// Static method to get conversation history
messageSchema.statics.getConversation = async function(user1Id, user2Id, limit = 50) {
  return this.find({
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('sender', 'username')
  .populate('receiver', 'username');
};

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
