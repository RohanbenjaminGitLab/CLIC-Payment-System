/** @param {string[]} allowed */
export function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const role = String(req.user.role || '').toLowerCase();
    const allowedRoles = allowed.map((r) => String(r).toLowerCase());
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/** Admin only */
export const adminOnly = requireRoles('admin');

/** Admin or Manager */
export const adminOrManager = requireRoles('admin', 'manager');

/** Any authenticated staff-level including viewing */
export const anyRole = requireRoles('admin', 'manager', 'staff');
