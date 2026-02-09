const router = require('express').Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * GET /api/users/search?q=username
 */
router.get('/search', auth, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);

  const users = await User.find({
    username: { $regex: q, $options: 'i' }
  })
    .select('_id username')
    .limit(10);

  res.json(users);
});

module.exports = router;
