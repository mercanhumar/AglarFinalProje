// server.js
const express = require('express');
const https = require('https');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');
const Call = require('./models/Call');

// Import routes
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');

// Import controllers
const UserController = require('./controllers/userController');
const MessageController = require('./controllers/messageController');
const CallController = require('./controllers/callController');

// Import middleware
const { authenticateToken } = require('./middleware/authMiddleware');

// Load environment variables
dotenv.config();

const app = express();

// SSL configuration
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.cert'))
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Static files
app.use(express.static(path.join(__dirname)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);

// Message routes
app.get('/api/messages/history/:userId', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching message history:', {
      userId: req.user.id,
      otherUserId: req.params.userId
    });

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username')
    .populate('receiver', 'username');

    console.log('Found messages:', messages.length);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch message history',
      message: error.message 
    });
  }
});

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize controllers with io instance
const userController = new UserController(io);
const messageController = new MessageController(io);
const callController = new CallController(io);

// Active users and calls tracking
const activeUsers = new Map();
const activeCalls = new Map();

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    socket.userId = user._id;
    socket.username = user.username;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// Handle socket connections
io.on('connection', async (socket) => {
  try {
    console.log('User connected:', socket.username, 'Socket ID:', socket.id);
    
    // Add user to active users
    activeUsers.set(socket.userId.toString(), socket.id);
    console.log('Active users:', Array.from(activeUsers.entries()));
    
    // Update user status
    await User.findByIdAndUpdate(socket.userId, { 
      isOnline: true,
      lastSeen: new Date()
    });
    
    // Notify others that user is online
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'online'
    });

    // Handle private messages
    socket.on('private_message', async (data) => {
      try {
        console.log('Private message:', data);
        const { recipientId, content } = data;

        // Create and save message
        const message = new Message({
          sender: socket.userId,
          receiver: recipientId,
          content: content,
          status: 'sent'
        });

        await message.save();
        
        // Populate sender and receiver info
        await message.populate('sender', 'username');
        await message.populate('receiver', 'username');

        // Get recipient's socket
        const recipientSocketId = activeUsers.get(recipientId.toString());
        
        // Send to recipient if online
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('private_message', message);
          
          // Update message status to delivered
          message.status = 'delivered';
          await message.save();
        }

        // Send confirmation to sender with final message state
        socket.emit('message_sent', message);

      } catch (error) {
        console.error('Error handling private message:', error);
        socket.emit('message_error', { 
          error: 'Failed to send message',
          details: error.message 
        });
      }
    });

    // Handle message seen status
    socket.on('message_seen', async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.receiver.toString() === socket.userId.toString()) {
          message.status = 'seen';
          await message.save();

          // Notify sender
          const senderSocketId = activeUsers.get(message.sender.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit('message_status', {
              messageId: message._id,
              status: 'seen'
            });
          }
        }
      } catch (error) {
        console.error('Error updating message seen status:', error);
      }
    });

    // Handle typing events
    socket.on('typing', (data) => {
      const recipientSocketId = activeUsers.get(data.to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user_typing', { from: socket.userId });
      }
    });

    socket.on('stop_typing', (data) => {
      const recipientSocketId = activeUsers.get(data.to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('user_stop_typing', { from: socket.userId });
      }
    });

    // Handle call request
    socket.on('call_request', async (data) => {
      console.log('Call request received:', {
        from: socket.username,
        fromId: socket.userId,
        to: data.to,
        socketId: socket.id
      });

      const recipientId = data.to.toString();
      const recipientSocketId = activeUsers.get(recipientId);
      
      console.log('Looking for recipient:', {
        recipientId,
        recipientSocketId,
        activeUsers: Array.from(activeUsers.entries())
      });
      
      if (recipientSocketId) {
        console.log('Sending incoming call to recipient:', recipientSocketId);
        io.to(recipientSocketId).emit('incoming_call', {
          callerId: socket.userId,
          callerUsername: data.username
        });
      } else {
        console.log('Recipient not found or offline:', recipientId);
        socket.emit('call_error', {
          error: 'User is offline'
        });
      }
    });

    // Handle call accepted
    socket.on('call_accepted', (data) => {
      console.log('Call accepted:', {
        by: socket.username,
        byId: socket.userId,
        to: data.to
      });

      const callerSocketId = activeUsers.get(data.to.toString());
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', {
          accepterId: socket.userId,
          accepterUsername: socket.username
        });
      }
    });

    // Handle call rejected
    socket.on('call_rejected', (data) => {
      console.log('Call rejected:', {
        by: socket.username,
        to: data.to
      });

      const callerSocketId = activeUsers.get(data.to.toString());
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected');
      }
    });

    // Handle call ended
    socket.on('end_call', (data) => {
      console.log('Call ended by:', socket.username);
      
      if (data.to) {
        const recipientSocketId = activeUsers.get(data.to.toString());
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('call_ended');
        }
      }
    });

    // WebRTC signaling
    socket.on('webrtc:offer', (data) => {
      const recipientSocketId = activeUsers.get(data.to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc:offer', {
          from: socket.userId,
          sdp: data.sdp
        });
      }
    });

    socket.on('webrtc:answer', (data) => {
      const recipientSocketId = activeUsers.get(data.to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc:answer', {
          from: socket.userId,
          sdp: data.sdp
        });
      }
    });

    socket.on('webrtc:ice-candidate', (data) => {
      const recipientSocketId = activeUsers.get(data.to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc:ice-candidate', {
          from: socket.userId,
          candidate: data.candidate
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.username);
      
      // Remove from active users
      activeUsers.delete(socket.userId.toString());
      console.log('Updated active users:', Array.from(activeUsers.entries()));
      
      // Update user status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });
      
      // Notify others that user is offline
      socket.broadcast.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline'
      });
    });

  } catch (error) {
    console.error('Error in socket connection:', error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
});
