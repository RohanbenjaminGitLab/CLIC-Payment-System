/** Only admins may delete records; consistent error for staff/manager UI. */
export function requireAdminDelete(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You are not authorized to delete this data.' });
  }
  next();
}
