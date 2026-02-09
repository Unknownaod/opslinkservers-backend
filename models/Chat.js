const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const ChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [MessageSchema]
}, {
  timestamps: { createdAt: true, updatedAt: true } // auto-manage createdAt & updatedAt
});

// Virtual for last message content
ChatSchema.virtual('lastMessage').get(function() {
  if (!this.messages || this.messages.length === 0) return '';
  return this.messages[this.messages.length - 1].content;
});

// Ensure virtuals are included when converting to JSON
ChatSchema.set('toJSON', { virtuals: true });
ChatSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Chat', ChatSchema);
