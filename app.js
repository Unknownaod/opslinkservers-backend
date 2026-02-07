require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --------------------
// Routes
// --------------------
const authRoutes = require('./routes/auth');      // CommonJS style
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');

const app = express();

// --------------------
// CORS Setup
// --------------------
const allowedOrigins = [
  'https://servers.opslinksystems.xyz',                 // production frontend
  'https://opslinkservers-ek35d02rp-opslink-systems-projects.vercel.app', // Vercel frontend
  'http://localhost:3000',                              // local dev
  'http://localhost:5500',                              // live preview
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server requests
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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --------------------
// Routes
// --------------------
// Make sure /api/auth matches your frontend fetch
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);

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
// Server listen
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
