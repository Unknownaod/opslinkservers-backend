const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userDiscord: {
    username: String,
    tag: String
  },
  text: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);
