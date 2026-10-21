// Usage: router.post('/', allow('admin'), handler)
module.exports = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  res.status(403).json({ success: false, error: 'You do not have permission to do this' });
};
