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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

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
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  })
  .then(() => {
    console.log('Connected to MongoDB successfully');
    // Start server after successful database connection
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.use('/api/auth', authRoutes);
app.use(express.static(__dirname));

app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug endpoint working',
    nodeEnv: process.env.NODE_ENV,
  });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/chat', authenticateToken, handleInactivity, (req, res) => {
  res.status(200).json({ message: 'Welcome to the chat!', userId: req.user.id });
});

// Socket rate limiting
const socketLimiter = new Map();
function checkSocketLimit(socketId) {
  const now = Date.now();
  const limit = 50; // messages per time window
  const timeWindow = 60 * 1000; // 1 minute

  if (!socketLimiter.has(socketId)) {
    socketLimiter.set(socketId, { count: 1, timestamp: now });
    return true;
  }

  const userLimit = socketLimiter.get(socketId);
  if (now - userLimit.timestamp > timeWindow) {
    userLimit.count = 1;
    userLimit.timestamp = now;
    return true;
  }

  if (userLimit.count >= limit) {
    return false;
  }

  userLimit.count++;
  return true;
}

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
      socket.on('get_users', () => {
        socket.emit('users_list', Array.from(onlineUsers.values()));
      });

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
          
        } catch (error) {
          console.error('Error fetching chat history:', error);
          socket.emit('error', { message: 'Failed to fetch chat history' });
        }
      });

      // Handle sending messages
      socket.on('send_message', async ({ recipientId, content }) => {
        try {
          if (!recipientId || !content) {
            return socket.emit('error', { message: 'Recipient and content are required' });
          }

          // Find recipient's socket
          const recipientData = onlineUsers.get(recipientId);
          const recipientSocket = recipientData ? io.sockets.sockets.get(recipientData.socketId) : null;

          // Create and save the message
          const message = new Message({
            senderId: socket.userId,
            recipientId,
            content,
            timestamp: new Date(),
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

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle user disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${user.username}`);
        onlineUsers.delete(user._id.toString());
        io.emit('users_list', Array.from(onlineUsers.values()));
      });
    } catch (error) {
      console.error('Socket connection error:', error);
      socket.disconnect();
    }
  })();
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});
