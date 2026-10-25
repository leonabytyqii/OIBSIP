function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Please log in to continue.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Access denied. Admin account required.",
    });
  }

  next();
}

module.exports = requireAdmin;