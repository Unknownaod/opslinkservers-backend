// middleware/authSocket.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Auth helper for sockets
 * @param {string} token - JWT from socket auth
 * @returns {Promise<User|null>} - authenticated user or null
 */
module.exports = async function authSocket(token) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) return null;

    const user = await User.findById(decoded.id);
    if (!user) return null;

    /**
     * 🔑 BACKWARD-COMPAT LOGIC
     * - Old tokens: decoded.tokenVersion === undefined → allow
     * - New tokens: must match user.tokenVersion
     */
    if (
      typeof decoded.tokenVersion !== 'undefined' &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return null;
    }

    return user; // return authenticated user
  } catch (err) {
    console.error('❌ Socket auth failed:', err.message);
    return null;
  }
};
