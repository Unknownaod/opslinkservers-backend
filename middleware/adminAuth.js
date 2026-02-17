// middleware/adminAuth.js
module.exports = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'management')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Admins or management only.' });
};
