const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Signup
router.post('/signup', async (req,res) => {
  const { email, password, discordUsername, discordUserID, discordTag } = req.body;
  if(!email || !password || !discordUsername || !discordUserID) 
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const user = new User({ email, password, discordUsername, discordUserID, discordTag });
    await user.save();
    res.status(201).json({ message: 'Account created' });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:'Server error' });
  }
});

// Login
router.post('/login', async (req,res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if(!user) return res.status(400).json({ error:'Invalid credentials' });

  const valid = await user.comparePassword(password);
  if(!valid) return res.status(400).json({ error:'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn:'7d' });
  res.json({ token, user: { email:user.email, discordUsername:user.discordUsername, role:user.role } });
});

module.exports = router;
