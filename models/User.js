const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  // =========================
  // Basic auth info
  // =========================
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // =========================
  // Discord info
  // =========================
  discordUsername: { type: String, required: true },
  discordTag: { type: String },
  discordUserID: { type: String, required: true },
  discordAvatar: { type: String },       // Avatar hash
  discordStatus: { type: String },       // online, idle, dnd, offline
  discordActivity: { type: String },     // Playing game / listening / streaming
  discordBadges: { type: [String], default: [] }, // Array of badge names

  // =========================
  // User role
  // =========================
  role: { type: String, enum: ['user','admin','management'], default: 'user' },

  // =========================
  // Premium flag
  // =========================
  isPremium: { type: Boolean, default: false },

  // =========================
  // Email verification
  // =========================
  isVerified: { type: Boolean, default: true },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

  // =========================
  // Password reset
  // =========================
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  // =========================
  // Token version for session invalidation
  // =========================
  tokenVersion: { type: Number, default: 0 },

  // =========================
  // Timestamps
  // =========================
}, { timestamps: true });

// =========================
// Hash password before save
// =========================
userSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// =========================
// Compare password method
// =========================
userSchema.methods.comparePassword = function(pass){
  return bcrypt.compare(pass, this.password);
};

module.exports = mongoose.model('User', userSchema);
