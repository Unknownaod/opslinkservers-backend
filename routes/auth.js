const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();
const logoURL = "https://cdn.discordapp.com/attachments/1463619235904229378/1466802083834368184/FuwELkz.png?ex=69889d64&is=69874be4&hm=d91b7dc2a57a579671ead07b48c9dcf31f17984940c54ac8029b4bf571283396";

// Helper to generate sleek email HTML
const generateEmailHTML = (title, message, buttonText, buttonURL) => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: linear-gradient(145deg, #1b1b1b, #0a0a0a); box-shadow: 0 8px 25px rgba(0,0,0,0.5); border: 1px solid #222;">
      <!-- Header -->
      <div style="background: linear-gradient(90deg, #111, #222); padding: 20px; text-align: center;">
        <img src="${logoURL}" alt="OpsLink Logo" style="max-width: 150px;" />
      </div>

      <!-- Body -->
      <div style="padding: 30px 25px; line-height: 1.6; font-size: 16px;">
        <h2 style="font-size: 24px; margin-bottom: 20px; color: #f1f1f1;">${title}</h2>
        <p style="color: #ccc; margin-bottom: 30px;">${message}</p>
        <a href="${buttonURL}" style="display:inline-block; padding:12px 25px; background: linear-gradient(90deg,#4f46e5,#6366f1); color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; transition: all 0.3s ease;">
          ${buttonText}
        </a>
      </div>

      <!-- Footer -->
      <div style="background: #111; padding: 15px 25px; font-size: 12px; color: #666; text-align: center;">
        OpsLink &copy; ${new Date().getFullYear()}. All rights reserved.
      </div>
    </div>
  </div>
`;

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
      html: generateEmailHTML(
        "Welcome to OpsLink",
        "Please verify your email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
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
      html: generateEmailHTML(
        "Email Verification",
        "Please verify your email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
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
      html: generateEmailHTML(
        "Email Updated",
        "Please verify your new email by clicking the button below:",
        "Verify Email",
        verifyURL
      )
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


// =======================
// Forgot Password
// =======================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset.html?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'OpsLink Password Reset',
      html: generateEmailHTML(
        "Reset Your Password",
        "Click the button below to reset your password. This link expires in 1 hour.",
        "Reset Password",
        resetURL
      )
    });

    res.json({ success: true, message: 'Password reset email sent', redirect: '/passwordverify.html' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =======================
// Verify Reset Token
// =======================
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token missing' });

  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    res.json({ success: true, email: user.email });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// =======================
// Reset Password
// =======================
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  try {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;

