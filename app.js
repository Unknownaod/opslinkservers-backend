require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');

const app = express();

// CORS Setup - Allow only specific origins for security
const allowedOrigins = [
  'https://servers.opslinksystems.xyz',
  'http://localhost:3000', // optional, for local dev
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true, // Allow cookies/authorization headers
}));

// Middleware for parsing JSON bodies
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Terminate the app if the DB connection fails
  });

// Use the imported route modules
app.use('/api', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);

// Simple Health Check Route
app.get('/', (req, res) => res.send('OpsLink Backend is running'));

// Ensure the server is running on the correct port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
