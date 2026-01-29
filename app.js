require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log('MongoDB connected'))
  .catch(err=>console.error(err));

app.use('/api', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req,res)=>res.send('OpsLink Backend is running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
