const mongoose = require('mongoose');

// ================================
// EDIT REQUEST SCHEMA (FIXED)
// ================================
const editRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changes: {
    description: String,
    logo: String,
    website: String,
    language: String,
    members: Number,
    type: String,
    nsfw: Boolean,
    tags: [String]
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Pre-save hook: remove undefined or empty string fields from changes
editRequestSchema.pre('save', function(next) {
  if (this.changes) {
    const allowedFields = ['description','logo','website','language','members','type','nsfw','tags'];
    const filtered = {};
    allowedFields.forEach(f => {
      if (this.changes[f] !== undefined && this.changes[f] !== '') {
        filtered[f] = this.changes[f];
      }
    });
    this.changes = filtered;
  }
  next();
});

// ================================
// SERVER SCHEMA
// ================================
const serverSchema = new mongoose.Schema({

  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 600 },
  invite: { type: String, required: true, trim: true, maxlength: 255 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1024 },
  language: { type: String, trim: true, maxlength: 32 },
  members: { type: Number, min: 0, max: 10_000_000, default: 0 },
  discordServerId: { type: String, trim: true, maxlength: 64, index: true },
  type: { type: String, trim: true, maxlength: 32 },
  rules: { type: String, trim: true, maxlength: 4096 },
  website: { type: String, trim: true, maxlength: 255 },
  nsfw: { type: Boolean, default: false },
  sponsored: { type: Boolean, default: false },
  
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: arr => arr.length <= 5,
      message: 'You may only have up to 5 tags.'
    }
  },

  logo: { type: String, required: true, trim: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'taken-down'],
    default: 'pending',
    index: true
  },

  rejectionReason: { type: String, maxlength: 512 },

  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  submitterDiscord: {
    username: String,
    userID: String,
    tag: String
  },

  reports: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true, maxlength: 1024 },
    createdAt: { type: Date, default: Date.now }
  }],

  editRequests: {
    type: [editRequestSchema],
    default: []
  },

  // ✅ Add reviews here
reviews: [
  {
    discordUsername: { type: String, required: true }, // store Discord username at the time of review
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1024 },
    createdAt: { type: Date, default: Date.now }
  }
]

}, { timestamps: true });

// ================================
// INDEXES
// ================================
serverSchema.index({ name: 'text', description: 'text', tags: 'text' });
serverSchema.index({ status: 1 });
serverSchema.index({ discordServerId: 1 });
serverSchema.index({ 'editRequests.status': 1 });

module.exports = mongoose.model('Server', serverSchema);


