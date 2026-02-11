const express = require('express');
const auth = require('../middleware/auth'); // your JWT middleware
const User = require('../models/User');

const router = express.Router();

/**
 * GET /api/profile/:id?
 * - No :id → current user
 * - Admins can fetch any user
 * - Normal users fetching others → only public info
 */
router.get('/:id?', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the requester
    const requester = await User.findById(req.user.id).lean();
    if (!requester) return res.status(404).json({ message: 'Requester not found' });

    let user;
    if (!id || id === requester._id.toString()) {
      // Fetch self
      user = requester;
    } else {
      // Fetch another user
      user = await User.findById(id).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });
    }

    // Decide what fields to return
    let response;
    if (requester.role === 'admin') {
      // Admin sees almost everything except sensitive tokens/passwords
      response = {
        email: user.email,
        discordUsername: user.discordUsername,
        discordTag: user.discordTag,
        discordUserID: user.discordUserID,
        role: user.role,
        isVerified: user.isVerified,
        tokenVersion: user.tokenVersion,
      };
    } else if (!id || id === requester._id.toString()) {
      // Normal user fetching self → limited sensitive info
      response = {
        email: user.email,
        discordUsername: user.discordUsername,
        discordTag: user.discordTag,
        role: user.role,
        isVerified: user.isVerified,
      };
    } else {
      // Normal user fetching someone else → only public info
      response = {
        discordUsername: user.discordUsername,
        discordTag: user.discordTag,
        role: user.role,
      };
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
