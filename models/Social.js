const mongoose = require('mongoose');

const socialSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { 
    type: String, 
    enum: ['discord','twitter','instagram','github','tiktok','linkedin'], 
    required: true 
  },
  handle: { type: String, required: true }, // username or handle
  url: { type: String, required: true },    // full URL to profile
}, { timestamps: true });

module.exports = mongoose.model('Social', socialSchema);
