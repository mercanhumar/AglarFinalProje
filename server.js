require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const https = require('https');
const { Server } = require('socket.io');
const authenticateToken = require('./middleware/authMiddleware'); // Import middleware
const authRoutes = require('./routes/auth'); // Authentication routes

const app = express();
const PORT = process.env.PORT || 5000;

// Express Middleware
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

// SSL/TLS Configuration
const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
};

// HTTPS Server
const httpsServer = https.createServer(httpsOptions, app);

// Socket.IO Setup
const io = new Server(httpsServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: String,
  recipientId: String, // Null for broadcast
  content: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
});

const Message = mongoose.model('Message', messageSchema);

// Authentication Routes
app.use('/api/auth', authRoutes);

// Protected Chat Endpoint
app.get('/chat', authenticateToken, (req, res) => {
  res.status(200).json({ message: 'Welcome to the chat!', userId: req.user.userId });
});

// Socket.IO Handlers with Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  // Verify JWT
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    socket.user = user; // Attach user data to socket
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.userId}`);

  socket.on('send_message', async ({ recipientId, content }) => {
    try {
      const message = new Message({ senderId: socket.user.userId, recipientId, content });
      await message.save();
      const recipientSocket = Array.from(io.sockets.sockets.values())
        .find((s) => s.user.userId === recipientId);

      if (recipientSocket) {
        recipientSocket.emit('receive_message', message);
        message.status = 'delivered';
        await message.save();
      }
      socket.emit('message_status', { messageId: message._id, status: message.status });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('broadcast_message', async ({ content }) => {
    try {
      const message = new Message({ senderId: socket.user.userId, content, recipientId: null });
      await message.save();
      io.emit('receive_message', message);
    } catch (err) {
      console.error('Error broadcasting message:', err);
    }
  });

  socket.on('message_delivered', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message) {
        message.status = 'delivered';
        await message.save();
        socket.emit('message_status', { messageId, status: 'delivered' });
      }
    } catch (err) {
      console.error('Error updating message status:', err);
    }
  });

  socket.on('message_read', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message) {
        message.status = 'read';
        await message.save();
        socket.emit('message_status', { messageId, status: 'read' });
      }
    } catch (err) {
      console.error('Error updating message status:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.userId}`);
  });
});

// Start HTTPS Server
httpsServer.listen(PORT, () => {
  console.log(`Secure server running on https://localhost:${PORT}`);
});
