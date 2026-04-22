import { verifyAccessToken } from '../utils/tokens.js';
import { query } from '../config/db.js';

export async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const payload = verifyAccessToken(token);
    const rows = await query('SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1', [payload.sub]);
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    req.user = {
      id: user.id,
      role: String(user.role || '').toLowerCase(),
      email: user.email,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    if (token) {
      const payload = verifyAccessToken(token);
      const rows = await query('SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1', [payload.sub]);
      const user = rows[0];
      if (user && user.is_active) {
        req.user = { id: user.id, role: String(user.role || '').toLowerCase(), email: user.email };
      } else {
        req.user = null;
      }
    }
  } catch {
    req.user = null;
  }
  next();
}
