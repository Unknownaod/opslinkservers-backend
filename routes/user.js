const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// ===========================
// GET CURRENT USER
// ===========================
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      email: user.email,
      discordUsername: user.discordUsername,
      discordUserID: user.discordUserID,
      discordTag: user.discordTag || '',
      role: user.role,
      isVerified: user.isVerified
    });

  } catch (err) {
    console.error('GET /api/user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
