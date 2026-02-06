const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  const { email, password, discordUsername, discordUserID, discordTag } = req.body;
  if (!email || !password || !discordUsername || !discordUserID)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Check if email already exists
    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) {
      return res.status(400).json({
        error: 'Account with this email already exists',
        existingUser: {
          discordUsername: existingEmailUser.discordUsername,
          discordUserID: existingEmailUser.discordUserID,
          email: existingEmailUser.email,
        }
      });
    }

    // Check if Discord username already exists
    const existingDiscordUser = await User.findOne({ discordUsername });
    if (existingDiscordUser) {
      return res.status(400).json({
        error: 'Account with this Discord username already exists',
        existingUser: {
          discordUsername: existingDiscordUser.discordUsername,
          discordUserID: existingDiscordUser.discordUserID,
          email: existingDiscordUser.email,
        }
      });
    }

    // Check if Discord ID already exists
    const existingDiscordID = await User.findOne({ discordUserID });
    if (existingDiscordID) {
      return res.status(400).json({
        error: 'Account with this Discord ID already exists',
        existingUser: {
          discordUsername: existingDiscordID.discordUsername,
          discordUserID: existingDiscordID.discordUserID,
          email: existingDiscordID.email,
        }
      });
    }

    // If no conflicts, create the user
    const user = new User({ email, password, discordUsername, discordUserID, discordTag });
    await user.save();

    res.status(201).json({ message: 'Account created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { email: user.email, discordUsername: user.discordUsername, role: user.role } });
});

module.exports = router;
