const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(token) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return null;
    return user;
  } catch (err) {
    return null;
  }
};
