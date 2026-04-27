const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (
      typeof decoded.tokenVersion !== 'undefined' &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        error: 'Token expired due to password change'
      });
    }

    req.user = {
      _id: user._id,         
      email: user.email,     
      discordUsername: user.discordUsername,
      discordTag: user.discordTag,
      role: user.role,
      isVerified: user.isVerified,
      tokenVersion: user.tokenVersion,
      token: token           
    };

    next();

  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
