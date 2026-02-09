require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// --------------------
// Import Routes
// --------------------
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const messagesRoutes = require('./routes/messages');

const app = express();

// --------------------
// CORS Setup
// --------------------
const allowedOrigins = [
  'file://',
  'https://servers.opslinksystems.xyz',
  'https://opslinkservers-ek35d02rp-opslink-systems-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('❌ Blocked by CORS:', origin);
    return callback(new Error('CORS not allowed'), false);
  },
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  credentials: true,
}));

// --------------------
// Body parser
// --------------------
app.use(express.json());

// --------------------
// Serve static uploads
// --------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --------------------
// MongoDB Connection
// --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --------------------
// Routes
// --------------------
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messagesRoutes);

// --------------------
// Health check
// --------------------
app.get('/', (req, res) => res.send('OpsLink Backend is running'));

// --------------------
// 404 catch-all
// --------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// --------------------
// Error handling middleware
// --------------------
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
});

// --------------------
// HTTP Server + Socket.IO
// --------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET','POST'],
    credentials: true
  },
  path: '/socket.io',
});

global.io = io; // accessible in other routes

// --------------------
// Socket.IO HANDLERS
// --------------------
const Chat = require('./models/Chat');
const authSocket = require('./middleware/authSocket'); // token validation for sockets

io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  // -------- QR / token subscription --------
  socket.on('subscribe-token', token => {
    if (!token) return;
    socket.join(token);
    console.log(`Socket ${socket.id} subscribed to token ${token}`);
  });

  // -------- Chat: join chat room --------
  socket.on('joinChat', chatId => {
    if (!chatId) return;
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // -------- Chat: send message --------
  socket.on('sendMessage', async ({ chatId, content, token }) => {
    try {
      if (!chatId || !content?.trim() || !token) return;

      // Authenticate user
      const user = await authSocket(token);
      if (!user) return;

      // Fetch chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.participants.includes(user._id)) return;

      const message = {
        sender: user._id,
        content: content.trim(),
        createdAt: new Date()
      };

      chat.messages.push(message);
      chat.updatedAt = new Date();
      await chat.save();

      await chat.populate('messages.sender', 'username role');

      // Emit message to all participants in this chat
      io.to(chatId).emit('newMessage', { chatId, message: chat.messages.at(-1) });
    } catch (err) {
      console.error('❌ Error sending chat message:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// --------------------
// Start server
// --------------------
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
