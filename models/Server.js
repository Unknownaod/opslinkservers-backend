const mongoose = require('mongoose');

const editRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  changes: {
    name: String,
    invite: String,
    description: String,
    language: String,
    members: Number,
    type: String,
    rules: String,
    website: String,
    nsfw: Boolean,
    tags: [String],
    logo: String
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true
  },

  rejectionReason: {
    type: String,
    maxlength: 512
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { _id: false });


const serverSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 600
  },

  invite: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },

  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1024
  },

  language: {
    type: String,
    trim: true,
    maxlength: 32
  },

  members: {
    type: Number,
    min: 0,
    max: 10_000_000,
    default: 0
  },

  discordServerId: {
    type: String,
    trim: true,
    maxlength: 64,
    index: true
  },

  type: {
    type: String,
    trim: true,
    maxlength: 32
  },

  rules: {
    type: String,
    trim: true,
    maxlength: 4096
  },

  website: {
    type: String,
    trim: true,
    maxlength: 255
  },

  nsfw: {
    type: Boolean,
    default: false
  },

  tags: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.length <= 5;
      },
      message: 'You may only have up to 5 tags.'
    }
  },

  logo: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'taken-down'],
    default: 'pending',
    index: true
  },

  rejectionReason: {
    type: String,
    maxlength: 512
  },

  submitter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  submitterDiscord: {
    username: { type: String, trim: true },
    userID: { type: String, trim: true },
    tag: { type: String, trim: true }
  },

  reports: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true, maxlength: 1024 },
    createdAt: { type: Date, default: Date.now }
  }],

  // ================================
  // SERVER EDIT REQUEST SYSTEM
  // ================================

  editRequests: {
    type: [editRequestSchema],
    default: []
  }

}, { timestamps: true });


// ---------- Indexes for performance ----------
serverSchema.index({ name: 'text', description: 'text', tags: 'text' });
serverSchema.index({ tags: 1 });
serverSchema.index({ status: 1 });
serverSchema.index({ discordServerId: 1 });
serverSchema.index({ 'editRequests.status': 1 });

module.exports = mongoose.model('Server', serverSchema);
