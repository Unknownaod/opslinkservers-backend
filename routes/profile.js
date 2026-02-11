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

    // The requester (logged-in user)
    const requester = req.user; // Already processed by auth middleware
    if (!requester) return res.status(401).json({ message: 'Unauthorized' });

    let user;
    if (!id || id === requester._id) {
      // Fetch self
      user = await User.findById(requester._id).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });
    } else {
      // Fetch another user
      user = await User.findById(id).lean();
      if (!user) return res.status(404).json({ message: 'User not found' });
    }

    // Decide which fields to return
    let response = { _id: user._id }; // always include _id for shareable link

    if (requester.role === 'admin' || (!id || id === requester._id)) {
      // Admins or self → full profile (safe)
      response.email = user.email;
      response.discordUsername = user.discordUsername;
      response.discordTag = user.discordTag;
      response.discordUserID = user.discordUserID;
      response.role = user.role;
      response.isVerified = user.isVerified;
      // optionally include other non-sensitive info if needed
    } else {
      // Normal user fetching someone else → only public info
      response.discordUsername = user.discordUsername;
      response.discordTag = user.discordTag;
      response.role = user.role;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
