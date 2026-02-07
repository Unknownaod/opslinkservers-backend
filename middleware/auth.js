const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Check tokenVersion to invalidate old tokens
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token expired due to password change' });
    }

    req.user = user;
    next();

  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
