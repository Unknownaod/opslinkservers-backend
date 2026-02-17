const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/* =========================
   Social connection schema
========================= */
const SocialSchema = new mongoose.Schema({
  connected: { type: Boolean, default: false },
  username: { type: String },
  profileUrl: { type: String },
  accessToken: { type: String },
  refreshToken: { type: String },
}, { _id: false });

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
  discordAvatar: { type: String },
  discordStatus: { type: String },
  discordActivity: { type: String },
  discordBadges: { type: [String], default: [] },

  // =========================
  // User role
  // =========================
  role: {
    type: String,
    enum: ['user', 'admin', 'management'],
    default: 'user'
  },

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
  // Token version
  // =========================
  tokenVersion: { type: Number, default: 0 },

  // =========================
  // Connected socials (FINAL)
  // =========================
  socials: {
    twitch: { type: SocialSchema, default: () => ({}) },
    spotify: { type: SocialSchema, default: () => ({}) },
    youtube: { type: SocialSchema, default: () => ({}) },
    github: { type: SocialSchema, default: () => ({}) },
  }

}, { timestamps: true });

/* =========================
   Hash password before save
========================= */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/* =========================
   Compare password
========================= */
userSchema.methods.comparePassword = function (pass) {
  return bcrypt.compare(pass, this.password);
};

module.exports = mongoose.model('User', userSchema);
