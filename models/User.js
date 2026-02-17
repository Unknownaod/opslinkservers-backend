const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  discordUsername: { type: String, required: true },
  discordUserID: { type: String, required: true },
  discordTag: { type: String },
  role: { type: String, enum: ['user','admin','management'], default: 'user' },

  // =========================
  // Premium flag
  // =========================
  isPremium: { type: Boolean, default: false },

  // =========================
  // Email verification fields
  // =========================
  isVerified: { type: Boolean, default: true },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

  // =========================
  // Password reset fields
  // =========================
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },

  // =========================
  // Token version for session invalidation
  // =========================
  tokenVersion: { type: Number, default: 0 }
});

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

