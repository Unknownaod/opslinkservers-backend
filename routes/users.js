// routes/users.js
const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * GET /api/users/search?q=
 * Search users by discordUsername
 */
router.get('/search', auth, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);

  try {
    const users = await User.find({
      discordUsername: { $regex: q, $options: 'i' } // case-insensitive
    })
      .limit(10)
      .select('discordUsername role'); // return only fields needed

    // Format for frontend
    const formatted = users.map(u => ({
      username: u.discordUsername,
      role: u.role
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
