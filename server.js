<<<<<<< HEAD
/****************************************************
 * server.js — Combined Chat + Voice Call
 ****************************************************/
const fs = require('fs'); // only if you need https
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');

require('dotenv').config();

// Models & Controllers
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const authRoutes = require('./routes/auth');
const authenticateToken = require('./controllers/authenticationToken');
const handleInactivity = require('./controllers/inactivity');

// ========================
// Express App Setup
// ========================
const app = express();
const PORT = process.env.PORT || 3000;
=======
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const authenticateToken = require('./controllers/authenticationToken');
const handleInactivity = require('./controllers/inactivity');
const authRoutes = require('./routes/auth');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

<<<<<<< HEAD
// CORS
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// Mongoose Connection
// ========================
=======
// CORS settings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Socket.IO setup
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    const user = await User.findById(decodedUser.userId);
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.userId = decodedUser.userId;
    socket.userDbId = user._id.toString();
    next();
  });
});

// Connect to MongoDB and start server
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  })
  .then(() => {
    console.log('Connected to MongoDB successfully');
<<<<<<< HEAD
    // Start server
    httpServer.listen(PORT, () => {
=======
    // Start server after successful database connection
    server.listen(PORT, () => {
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

<<<<<<< HEAD
// ========================
// Create HTTP Server, Socket.IO
// ========================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET','POST']
  }
});

// ========================
// Routes
// ========================
app.use('/api/auth', authRoutes);
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  // Serve your integrated index.html (chat + call)
  res.sendFile(path.join(__dirname, 'index.html'));
});

=======
app.use('/api/auth', authRoutes);
app.use(express.static(__dirname));

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug endpoint working',
    nodeEnv: process.env.NODE_ENV,
  });
});

<<<<<<< HEAD
// Protected chat route example
=======
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
app.get('/chat', authenticateToken, handleInactivity, (req, res) => {
  res.status(200).json({ message: 'Welcome to the chat!', userId: req.user.id });
});

<<<<<<< HEAD
// ========================
// Socket.IO Auth Middleware
// ========================
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  jwt.verify(token, process.env.JWT_SECRET, async (err, decodedUser) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    try {
      const user = await User.findById(decodedUser.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      // Use the UUID in chat
      socket.userId = user.userId;
      socket.userDbId = user._id.toString();
      socket.username = user.username; // helpful for call events
      next();
    } catch (dbError) {
      return next(new Error('Database error'));
    }
  });
});

// ========================
// Socket.IO State
// ========================
const socketLimiter = new Map(); // for rate limiting
const onlineUsers = new Map();   // userId -> { userId, username, socketId, online }
let users = {};                  // for call: username -> socket.id

function checkSocketLimit(socketId) {
  const now = Date.now();
  const limit = 50; // messages per minute
  const timeWindow = 60 * 1000;
=======
// Socket rate limiting
const socketLimiter = new Map();
function checkSocketLimit(socketId) {
  const now = Date.now();
  const limit = 50; // messages per time window
  const timeWindow = 60 * 1000; // 1 minute

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
  if (!socketLimiter.has(socketId)) {
    socketLimiter.set(socketId, { count: 1, timestamp: now });
    return true;
  }
<<<<<<< HEAD
=======

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
  const userLimit = socketLimiter.get(socketId);
  if (now - userLimit.timestamp > timeWindow) {
    userLimit.count = 1;
    userLimit.timestamp = now;
    return true;
  }
<<<<<<< HEAD
  if (userLimit.count >= limit) {
    return false;
  }
=======

  if (userLimit.count >= limit) {
    return false;
  }

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
  userLimit.count++;
  return true;
}

<<<<<<< HEAD
// ========================
// Socket.IO Connections
// ========================
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id, 'username:', socket.username);

  (async () => {
    try {
      // Mark them online
      const dbUser = await User.findOne({ userId: socket.userId });
      if (!dbUser) {
        socket.disconnect();
        return;
      }
      // Add to 'onlineUsers'
      onlineUsers.set(dbUser.userId, {
        userId: dbUser.userId,
        username: dbUser.username,
        socketId: socket.id,
        online: true,
      });
      // For call logic
      users[dbUser.username] = socket.id;

      // Notify everyone
      io.emit('users_list', Array.from(onlineUsers.values()));

      // ============ Chat events ============
=======
const onlineUsers = new Map();

io.on('connection', (socket) => {
  (async () => {
    try {
      const user = await User.findById(socket.userDbId);
      if (!user) {
        socket.disconnect();
        return;
      }

      // Add user to online users map
      onlineUsers.set(user._id.toString(), {
        userId: user.userId,
        username: user.username,
        socketId: socket.id,
        online: true,
      });

      console.log(`User connected: ${user.username}`);
      io.emit('users_list', Array.from(onlineUsers.values()));

      // Handle fetching online users
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
      socket.on('get_users', () => {
        socket.emit('users_list', Array.from(onlineUsers.values()));
      });

<<<<<<< HEAD
      socket.on('get_chat_history', async ({ userId }) => {
        try {
          console.log('Fetching chat history between', socket.userId, 'and', userId);
          const messages = await Message.find({
            $or: [
              { senderId: socket.userId, recipientId: userId },
              { senderId: userId, recipientId: socket.userId },
            ],
          })
            .sort({ timestamp: 1 })
            .limit(100);
          console.log(`Found ${messages.length} messages`);

          // Mark as read any messages from that user to me
          const unreadMessages = messages.filter(m =>
            m.senderId === userId &&
            m.recipientId === socket.userId &&
            m.status !== 'read'
          );
          if (unreadMessages.length > 0) {
            await Message.updateMany(
              { _id: { $in: unreadMessages.map(m => m._id) } },
              { $set: { status: 'read' } }
            );
            // Notify the sender
            const senderData = onlineUsers.get(userId);
            if (senderData) {
              const senderSocket = io.sockets.sockets.get(senderData.socketId);
              if (senderSocket) {
                unreadMessages.forEach((msg) => {
                  senderSocket.emit('message_status', {
                    messageId: msg._id,
                    status: 'read',
                  });
                });
              }
            }
          }
          socket.emit('receive_message', messages);
=======
      // Handle fetching chat history
      socket.on('get_chat_history', async ({ userId }) => {
        try {
          console.log('Fetching chat history between', socket.userId, 'and', userId);
          
          // Find all messages between these two users
          const messages = await Message.find({
            $or: [
              { senderId: socket.userId, recipientId: userId },
              { senderId: userId, recipientId: socket.userId }
            ]
          })
          .sort({ timestamp: 1 }) // Sort by timestamp ascending
          .limit(100); // Limit to last 100 messages

          console.log(`Found ${messages.length} messages`);
          
          // Update all received messages as 'read'
          const unreadMessages = messages.filter(msg => 
            msg.senderId === userId && 
            msg.recipientId === socket.userId && 
            msg.status !== 'read'
          );

          if (unreadMessages.length > 0) {
            await Message.updateMany(
              {
                _id: { $in: unreadMessages.map(msg => msg._id) }
              },
              {
                $set: { status: 'read' }
              }
            );

            // Notify the sender that their messages have been read
            const senderSocket = Array.from(io.sockets.sockets.values())
              .find(s => s.userId === userId);
            
            if (senderSocket) {
              unreadMessages.forEach(msg => {
                senderSocket.emit('message_status', {
                  messageId: msg._id,
                  status: 'read'
                });
              });
            }
          }

          // Send the chat history to the requesting client
          socket.emit('receive_message', messages);
          
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
        } catch (error) {
          console.error('Error fetching chat history:', error);
          socket.emit('error', { message: 'Failed to fetch chat history' });
        }
      });

<<<<<<< HEAD
      socket.on('typing', ({ recipientId }) => {
        // Let recipient know user is typing
        const recipientData = onlineUsers.get(recipientId);
        if (recipientData) {
          io.to(recipientData.socketId).emit('user_typing', {
            userId: socket.userId,
          });
        }
      });

      socket.on('stop_typing', ({ recipientId }) => {
        const recipientData = onlineUsers.get(recipientId);
        if (recipientData) {
          io.to(recipientData.socketId).emit('user_stop_typing', {
            userId: socket.userId,
          });
        }
      });

=======
      // Handle sending messages
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
      socket.on('send_message', async ({ recipientId, content }) => {
        try {
          if (!recipientId || !content) {
            return socket.emit('error', { message: 'Recipient and content are required' });
          }
<<<<<<< HEAD
          if (!checkSocketLimit(socket.id)) {
            return socket.emit('error', { message: 'Message rate limit exceeded. Please wait.' });
          }
          // If recipient is online
          const recipientData = onlineUsers.get(recipientId);
          const recipientSocket = recipientData
            ? io.sockets.sockets.get(recipientData.socketId)
            : null;

          // Create message
=======

          // Find recipient's socket
          const recipientData = onlineUsers.get(recipientId);
          const recipientSocket = recipientData ? io.sockets.sockets.get(recipientData.socketId) : null;

          // Create and save the message
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
          const message = new Message({
            senderId: socket.userId,
            recipientId,
            content,
            timestamp: new Date(),
<<<<<<< HEAD
            status: recipientSocket ? 'sent' : 'pending',
          });
          const savedMessage = await message.save();

          // Send back to sender
          socket.emit('receive_message', savedMessage);

          if (recipientSocket) {
            // Send to recipient
            recipientSocket.emit('receive_message', savedMessage);
            // Update to 'delivered'
            savedMessage.status = 'delivered';
            await savedMessage.save();
            // Notify sender
            socket.emit('message_status', {
              messageId: savedMessage._id,
              status: 'delivered',
            });
          }
=======
            status: recipientSocket ? 'sent' : 'pending'
          });

          const savedMessage = await message.save();
          
          // Send to sender
          socket.emit('receive_message', savedMessage);

          // Send to recipient if online
          if (recipientSocket) {
            recipientSocket.emit('receive_message', savedMessage);
            savedMessage.status = 'delivered';
            await savedMessage.save();
            
            // Notify sender of delivery
            socket.emit('message_status', {
              messageId: savedMessage._id,
              status: 'delivered'
            });
          }

>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

<<<<<<< HEAD
      socket.on('disconnect', () => {
        console.log('User disconnected:', dbUser.username);
        onlineUsers.delete(dbUser.userId);
        delete users[dbUser.username];
        io.emit('users_list', Array.from(onlineUsers.values()));
      });

      // ============ Voice Call events ============
      socket.on('callInitiated', ({ from, to }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('incomingCall', { from });
        }
      });
      socket.on('callAccepted', ({ from, to }) => {
        const targetSocketId = users[from];
        if (targetSocketId) {
          io.to(targetSocketId).emit('callAccepted');
        }
      });
      socket.on('callDeclined', ({ from, to }) => {
        const targetSocketId = users[from];
        if (targetSocketId) {
          io.to(targetSocketId).emit('callDeclined');
        }
      });
      socket.on('callEnded', ({ from, to }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('callEnded');
        }
      });
      socket.on('offer', ({ to, description }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('offer', description);
        }
      });
      socket.on('answer', ({ to, description }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('answer', description);
        }
      });
      socket.on('iceCandidate', ({ to, candidate }) => {
        const targetSocketId = users[to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('iceCandidate', candidate);
        }
      });
    } catch (err) {
      console.error('Socket connection error:', err);
=======
      // Handle user disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${user.username}`);
        onlineUsers.delete(user._id.toString());
        io.emit('users_list', Array.from(onlineUsers.values()));
      });
    } catch (error) {
      console.error('Socket connection error:', error);
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
      socket.disconnect();
    }
  })();
});

<<<<<<< HEAD
// ========================
// Global Error Handler
// ========================
=======
>>>>>>> e91bd7a65d8e5b4b40f149b4b7d93d2a32d45338
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});
