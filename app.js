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
const profileRoutes = require('./routes/profile');
const userRoutes = require('./routes/user');
const analyticRoutes = require('./routes/analytics'); // will use default connection

const app = express();

// --------------------
// CORS Setup
// --------------------
const allowedOrigins = [
  'file://',
  'https://servers.opslinksystems.xyz',
  'https://dash.opslinksystems.xyz',
  'https://www.opslinkservers.xyz',
  'https://opslinkservers.xyz',
  'https://opslinkservers.com',
  'https://www.opslinkservers.com',
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
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --------------------
// Analytics route uses default connection
// --------------------
app.use('/api/analytics', analyticRoutes);

// --------------------
// Other Routes
// --------------------
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/user', userRoutes);

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
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io',
});

global.io = io; // for QR / auth routes

io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  socket.on('subscribe-token', token => {
    socket.join(token);
    console.log(`Socket ${socket.id} subscribed to token ${token}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// --------------------
// Start server
// --------------------
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


