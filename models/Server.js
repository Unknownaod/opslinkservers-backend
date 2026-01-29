const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  invite: { type: String, required: true },
  description: { type: String, required: true },
  language: String,
  members: Number,
  type: String,
  rules: String,
  website: String,
  nsfw: { type: Boolean, default: false },
  tags: [String],
  status: { type: String, enum: ['pending','approved','denied'], default: 'pending' },
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submitterDiscord: {
    username: String,
    userID: String,
    tag: String
  },
  createdAt: { type: Date, default: Date.now },
  reports: [{ // new field for storing reports
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Server', serverSchema);
