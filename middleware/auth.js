const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {

  const authHeader = req.headers.authorization;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.id) {
      return res.status(401).json({
        error: 'Invalid token payload'
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    // Token invalidation check
    if (
      typeof decoded.tokenVersion !== 'undefined' &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        error: 'Token expired due to password change'
      });
    }

    // =========================
    // BAN CHECK
    // =========================
    if (user.ban?.isBanned) {

      // Auto unban expired bans
      if (
        user.ban.expiresAt &&
        user.ban.expiresAt < new Date()
      ) {

        user.ban = {
          isBanned: false,
          reason: null,
          bannedBy: null,
          bannedAt: null,
          expiresAt: null,
          banId: null
        };

        await user.save();

      } else {

        return res.status(403).json({
          banned: true,

          error: 'Account banned',

          ban: {
            reason: user.ban.reason,
            bannedBy: user.ban.bannedBy,
            bannedAt: user.ban.bannedAt,
            expiresAt: user.ban.expiresAt,
            banId: user.ban.banId
          }
        });

      }
    }

    // =========================
    // Attach user
    // =========================
    req.user = {
      _id: user._id,
      email: user.email,
      discordUsername: user.discordUsername,
      discordTag: user.discordTag,
      role: user.role,
      isVerified: user.isVerified,
      tokenVersion: user.tokenVersion,
      token: token,
      ban: user.ban
    };

    next();

  } catch (err) {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }
};
