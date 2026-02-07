const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// =======================
// Signup
// =======================
router.post('/signup', async (req, res) => {
  const { email, password, discordUsername, discordUserID, discordTag } = req.body;
  if (!email || !password || !discordUsername || !discordUserID)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check for duplicates
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const existingDiscordUser = await User.findOne({ discordUsername });
    if (existingDiscordUser) {
      return res.status(400).json({ error: 'Discord username already exists' });
    }
    const existingDiscordID = await User.findOne({ discordUserID });
    if (existingDiscordID) {
      return res.status(400).json({ error: 'Discord ID already exists' });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user (isVerified: false for new users)
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

    // Prepare verification email
    const verifyURL = `${process.env.FRONTEND_URL}/verify.html?token=${verificationToken}`;

    const emailHTML = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://cdn.discordapp.com/attachments/1463619235904229378/1466802083834368184/FuwELkz.png?ex=69889d64&is=69874be4&hm=d91b7dc2a57a579671ead07b48c9dcf31f17984940c54ac8029b4bf571283396&" 
             alt="OpsLink Logo" 
             style="width: 120px;">
      </div>
      
      <h2 style="color: #111827; text-align: center;">Welcome to OpsLink Servers!</h2>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for signing up! Please verify your email to activate your account by clicking the button below:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyURL}" 
           style="padding: 14px 25px; background-color: #4f46e5; color: white; text-decoration: none; font-weight: 600; border-radius: 8px; display: inline-block;">
          Verify Email
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
        If you did not create this account, you can safely ignore this email.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        OpsLink Servers<br>
        &copy; ${new Date().getFullYear()} OpsLink Systems. All rights reserved.
      </p>
    </div>
    `;

    // Send verification email
    await sendEmail({ to: email, subject: 'Verify Your OpsLink Account', html: emailHTML });

    // Redirect user to verify page (frontend)
    res.status(201).json({ message: 'Account created', redirect: '/verify.html' });

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
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

  // Block login if email not verified
  if (!user.isVerified) {
    return res.status(403).json({ error: 'Please verify your email before logging in' });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { email: user.email, discordUsername: user.discordUsername, role: user.role } });
});

module.exports = router;
