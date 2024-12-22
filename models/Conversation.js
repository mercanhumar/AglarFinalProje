<<<<<<< HEAD
// models/Conversation.js
=======
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [
    {
<<<<<<< HEAD
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
=======
      type: String, // userId from User model
      required: true,
    },
  ],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

conversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
});

module.exports = mongoose.model('Conversation', conversationSchema);
