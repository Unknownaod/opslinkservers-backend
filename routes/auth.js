const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// =======================
// Signup
// =======================
router.post('/signup', async (req, res) => {
  const { email, password, discordUsername, discordUserID, discordTag } = req.body;

  if (!email || !password || !discordUsername || !discordUserID) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser)
      return res.status(400).json({ error: 'Email already exists' });

    const existingDiscordUser = await User.findOne({ discordUsername });
    if (existingDiscordUser)
      return res.status(400).json({ error: 'Discord username already exists' });

    const existingDiscordID = await User.findOne({ discordUserID });
    if (existingDiscordID)
      return res.status(400).json({ error: 'Discord ID already exists' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    const user = new User({
      email,
      password,
      discordUsername,
      discordUserID,
      discordTag,
      isVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: email,
      subject: 'Verify Your OpsLink Account',
      html: `
        <div style="font-family: Segoe UI, Arial, sans-serif">
          <h2>Welcome to OpsLink</h2>
          <p>Please verify your email by clicking below:</p>
          <a href="${verifyURL}" style="padding:12px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Verify Email</a>
        </div>
      `
    });

    res.status(201).json({ message: 'Account created', redirect: '/verify.html', email });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Login
// =======================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    if (!user.isVerified)
      return res.status(403).json({ error: 'Please verify your email before logging in' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      token,
      user: {
        email: user.email,
        discordUsername: user.discordUsername,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Resend Verification Email
// =======================
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Email already verified' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your OpsLink Account',
      html: `
        <div style="font-family: Segoe UI, Arial, sans-serif">
          <h2>Email Verification</h2>
          <p>Please verify your email by clicking below:</p>
          <a href="${verifyURL}" style="padding:12px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Verify Email</a>
        </div>
      `
    });

    res.json({ success: true, message: 'Verification email resent' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Change Email (Before Verification)
// =======================
router.post('/change-email', async (req, res) => {
  const { oldEmail, newEmail } = req.body;

  if (!oldEmail || !newEmail)
    return res.status(400).json({ error: 'Both emails required' });

  try {
    const user = await User.findOne({ email: oldEmail });

    if (!user) return res.status(404).json({ error: 'Account not found' });
    if (user.isVerified)
      return res.status(400).json({ error: 'Email already verified' });

    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists)
      return res.status(400).json({ error: 'Email already in use' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.email = newEmail;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    const verifyURL = `https://opslinkservers-backend.onrender.com/api/auth/verify-email?token=${verificationToken}`;

    await sendEmail({
      to: newEmail,
      subject: 'Verify Your OpsLink Account',
      html: `
        <div style="font-family: Segoe UI, Arial, sans-serif">
          <h2>Email Updated</h2>
          <p>Please verify your new email:</p>
          <a href="${verifyURL}" style="padding:12px 20px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;">Verify Email</a>
        </div>
      `
    });

    res.json({ success: true, message: 'Email updated and verification resent' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Verify Email Token
// =======================
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);

  try {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.redirect(`${process.env.FRONTEND_URL}/verified.html`);

  } catch (err) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}/verify-failed.html`);
  }
});


module.exports = router;

