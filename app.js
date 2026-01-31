require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');

const app = express();

// --------------------
// CORS Setup
// --------------------
const allowedOrigins = [
  'https://servers.opslinksystems.xyz', // your production frontend
  'http://localhost:3000',              // local dev
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed'), false);
  },
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  credentials: true
}));

// --------------------
// Body parser
// --------------------
app.use(express.json());

// --------------------
// Serve static uploads (logos, images, etc.)
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
app.use('/api', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);

// --------------------
// Health check
// --------------------
app.get('/', (req, res) => res.send('OpsLink Backend is running'));

// --------------------
// Server listen
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // export for testing or bot integration
