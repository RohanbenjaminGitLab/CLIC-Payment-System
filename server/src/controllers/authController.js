import { query } from '../config/db.js';
import { hashPassword, verifyPassword, validateStrongPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from '../utils/tokens.js';
import { writeAudit } from '../services/auditService.js';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

function cookieOptions(httpOnly, maxAgeMs) {
  // In production (Vercel/Render), cookies MUST be secure for HTTPS
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const secure = process.env.COOKIE_SECURE === 'true' || isProd;
  const sameSite = process.env.COOKIE_SAME_SITE?.trim() || (secure ? 'none' : 'lax');
  
  return {
    httpOnly,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeMs,
  };
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

async function recordLogin(userId, email, req, success, reason = null) {
  await query(
    `INSERT INTO login_history (user_id, email_attempt, ip_address, user_agent, success, failure_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      email,
      clientIp(req),
      String(req.headers['user-agent'] || '').slice(0, 512),
      success ? 1 : 0,
      reason,
    ]
  );
}

async function suspiciousCheck(userId, ip) {
  const rows = await query(
    `SELECT COUNT(DISTINCT ip_address) AS c FROM login_history
     WHERE user_id = ? AND success = 1 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [userId]
  );
  const distinct = rows[0]?.c || 0;
  if (distinct >= 3) {
    await writeAudit(userId, 'SUSPICIOUS_MULTI_IP_LOGIN', 'security', String(userId), { ip }, ip);
  }
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    await recordLogin(null, email || '', req, false, 'missing_credentials');
    return res.status(400).json({ error: 'Email and password required' });
  }
  const users = await query(
    'SELECT id, name, email, password, role, is_active, failed_login_attempts, lock_until FROM users WHERE email = ?',
    [email]
  );
  const user = users[0];
  if (!user || !user.is_active) {
    await recordLogin(null, email, req, false, 'invalid_credentials');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.lock_until && new Date(user.lock_until) > new Date()) {
    await recordLogin(user.id, email, req, false, 'account_locked');
    return res.status(423).json({ error: 'Account is temporarily locked. Try again later.' });
  }
  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    const failed = Number(user.failed_login_attempts || 0) + 1;
    const lockUntil = failed >= 5 ? new Date(Date.now() + 3 * 60 * 60 * 1000) : null;
    await query(
      `UPDATE users SET failed_login_attempts = ?, lock_until = ? WHERE id = ?`,
      [lockUntil ? 0 : failed, lockUntil ? lockUntil : null, user.id]
    );
    await recordLogin(user.id, email, req, false, 'invalid_credentials');
    if (lockUntil) {
      await writeAudit(user.id, 'ACCOUNT_LOCKED', 'user', String(user.id), { until: lockUntil.toISOString() }, clientIp(req));
      return res.status(423).json({ error: 'Account locked for 3 hours due to repeated failed logins.' });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (Number(user.failed_login_attempts || 0) > 0 || user.lock_until) {
    await query(`UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = ?`, [user.id]);
  }

  await recordLogin(user.id, email, req, true);
  await suspiciousCheck(user.id, clientIp(req));

  const access = signAccessToken({
    sub: user.id,
    role: normalizeRole(user.role),
    email: user.email,
  });

  const rawRefresh = generateRefreshToken();
  const refreshHash = hashToken(rawRefresh);
  const days = Number(process.env.JWT_REFRESH_DAYS || 7);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [user.id, refreshHash, days]
  );

  res.cookie(ACCESS_COOKIE, access, cookieOptions(true, 15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, rawRefresh, cookieOptions(true, days * 24 * 60 * 60 * 1000));

  await writeAudit(user.id, 'LOGIN', 'auth', String(user.id), null, clientIp(req));

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: normalizeRole(user.role) },
  });
}

export async function refresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return res.status(401).json({ error: 'No refresh token' });
  const refreshHash = hashToken(raw);
  const rows = await query(
    `SELECT rt.user_id, u.email, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = ? AND rt.expires_at > NOW()`,
    [refreshHash]
  );
  const row = rows[0];
  if (!row || !row.is_active) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [refreshHash]);

  const access = signAccessToken({
    sub: row.user_id,
    role: normalizeRole(row.role),
    email: row.email,
  });
  const newRaw = generateRefreshToken();
  const newHash = hashToken(newRaw);
  const days = Number(process.env.JWT_REFRESH_DAYS || 7);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [row.user_id, newHash, days]
  );

  res.cookie(ACCESS_COOKIE, access, cookieOptions(true, 15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE, newRaw, cookieOptions(true, days * 24 * 60 * 60 * 1000));

  return res.json({ ok: true });
}

export async function logout(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(raw)]);
  }
  if (req.user?.id) {
    await writeAudit(req.user.id, 'LOGOUT', 'auth', String(req.user.id), null, clientIp(req));
  }
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  return res.json({ ok: true });
}

export async function me(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
  const u = rows[0];
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user: { ...u, role: normalizeRole(u.role) } });
}

export async function registerUser(req, res) {
  const { name, email, password, role, commission_rate, base_salary } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role required' });
  }
  if (!['admin', 'manager', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (req.user.role === 'manager' && role !== 'staff') {
    return res.status(403).json({ error: 'Managers may only create staff accounts' });
  }
  if (req.user.role === 'manager' && (commission_rate != null || base_salary != null)) {
    return res.status(403).json({ error: 'Only admin can manage salary and commission settings' });
  }
  let passwordApprovalQueued = false;
  const pwErr = validateStrongPassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const hash = await hashPassword(password);
  const commissionRate = Number(commission_rate ?? 5);
  const baseSalary = Number(base_salary ?? 0);
  if (Number.isNaN(commissionRate) || commissionRate < 0) {
    return res.status(400).json({ error: 'Invalid commission rate' });
  }
  if (Number.isNaN(baseSalary) || baseSalary < 0) {
    return res.status(400).json({ error: 'Invalid base salary' });
  }
  const result = await query(
    `INSERT INTO users (name, email, password, role, commission_rate, base_salary) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, hash, role, commissionRate, baseSalary]
  );
  const id = result.insertId;
  await writeAudit(req.user.id, 'USER_CREATE', 'user', String(id), { email, role }, clientIp(req));
  return res.status(201).json({ id, name, email, role });
}

export async function listUsers(req, res) {
  const roleFilter = req.query.role;
  const search = req.query.search;
  let sql =
    'SELECT id, name, email, role, commission_rate, base_salary, is_active, created_at FROM users WHERE 1=1';
  const params = [];
  if (req.user.role === 'manager') {
    sql += ' AND role = ?';
    params.push('staff');
  } else if (roleFilter && ['admin', 'manager', 'staff'].includes(roleFilter)) {
    sql += ' AND role = ?';
    params.push(roleFilter);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  sql += ' ORDER BY id DESC';
  const rows = await query(sql, params);
  return res.json(rows);
}

export async function updateUser(req, res) {
  const id = Number(req.params.id);
  const target = (await query('SELECT id, role FROM users WHERE id = ?', [id]))[0];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (req.user.role === 'manager' && target.role !== 'staff') {
    return res.status(403).json({ error: 'Managers may only update staff accounts' });
  }
  const { name, email, role, is_active, password, commission_rate, base_salary } = req.body || {};
  const managerRequestedCommission = req.user.role === 'manager' && commission_rate != null;
  const managerRequestedSalary = req.user.role === 'manager' && base_salary != null;
  if (req.user.role === 'manager' && role && role !== 'staff') {
    return res.status(403).json({ error: 'Invalid role change' });
  }
  if (managerRequestedCommission || managerRequestedSalary) {
    return res.status(403).json({ error: 'Only admin can manage salary and commission settings' });
  }
  let credentialApprovalQueued = false;

  // Manager -> staff username/email/password changes must go through admin approval queue.
  if (req.user.role === 'manager' && target.role === 'staff' && (name != null || email != null || password)) {
    let requestedName = null;
    let requestedEmail = null;
    let requestedPasswordHash = null;
    if (name != null && String(name).trim()) {
      requestedName = String(name).trim();
    }
    if (email != null && String(email).trim()) {
      const emailNorm = String(email).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const emailInUse = await query('SELECT id FROM users WHERE email = ? AND id != ?', [emailNorm, id]);
      if (emailInUse.length) return res.status(409).json({ error: 'Email already in use' });
      requestedEmail = emailNorm;
    }
    if (password) {
      const pwErr = validateStrongPassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });
      requestedPasswordHash = await hashPassword(password);
    }
    if (!requestedName && !requestedEmail && !requestedPasswordHash) {
      return res.status(400).json({ error: 'No credential changes provided' });
    }

    const pending = await query(
      `SELECT id FROM credential_change_requests
       WHERE user_id = ? AND status = 'pending'
         AND (new_name IS NOT NULL OR new_email IS NOT NULL OR new_password_hash IS NOT NULL)
       ORDER BY id DESC LIMIT 1`,
      [id]
    );
    if (pending.length) {
      return res.status(409).json({ error: 'A credential change request is already pending admin approval' });
    }

    await query(
      `INSERT INTO credential_change_requests (user_id, new_name, new_email, new_password_hash, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, requestedName, requestedEmail, requestedPasswordHash]
    );
    await writeAudit(
      req.user.id,
      'MANAGER_REQUESTED_CREDENTIAL_CHANGE',
      'credential_change_requests',
      String(id),
      {
        target_user_id: id,
        nameChange: !!requestedName,
        emailChange: !!requestedEmail,
        passwordChange: !!requestedPasswordHash,
      },
      clientIp(req)
    );
    credentialApprovalQueued = true;
  }
  const fields = [];
  const params = [];
  if (name != null && !(req.user.role === 'manager' && target.role === 'staff')) {
    fields.push('name = ?');
    params.push(name);
  }
  if (email != null && !(req.user.role === 'manager' && target.role === 'staff')) {
    const emailNorm = String(email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const emailInUse = await query('SELECT id FROM users WHERE email = ? AND id != ?', [emailNorm, id]);
    if (emailInUse.length) return res.status(409).json({ error: 'Email already in use' });
    fields.push('email = ?');
    params.push(emailNorm);
  }
  if (role != null) {
    if (!['admin', 'manager', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    fields.push('role = ?');
    params.push(role);
  }
  if (typeof is_active === 'boolean') {
    fields.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  if (commission_rate != null) {
    const rate = Number(commission_rate);
    if (Number.isNaN(rate) || rate < 0) return res.status(400).json({ error: 'Invalid commission rate' });
    fields.push('commission_rate = ?');
    params.push(rate);
  }
  if (base_salary != null) {
    const salary = Number(base_salary);
    if (Number.isNaN(salary) || salary < 0) return res.status(400).json({ error: 'Invalid base salary' });
    fields.push('base_salary = ?');
    params.push(salary);
  }
  if (password && !(req.user.role === 'manager' && target.role === 'staff')) {
    const pwErr = validateStrongPassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    fields.push('password = ?');
    params.push(await hashPassword(password));
  }
  if (!fields.length) {
    if (credentialApprovalQueued) {
      return res.status(202).json({
        ok: true,
        message: 'Your request has been sent to the Admin for approval. Please wait until it is approved.',
      });
    }
    return res.status(400).json({ error: 'No fields to update' });
  }
  params.push(id);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  await writeAudit(req.user.id, 'USER_UPDATE', 'user', String(id), { fields: Object.keys(req.body || {}) }, clientIp(req));
  if (credentialApprovalQueued) {
    return res.status(202).json({
      ok: true,
      message: 'Your request has been sent to the Admin for approval. Please wait until it is approved.',
    });
  }
  return res.json({ ok: true });
}

export async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete self' });
  const target = (await query('SELECT role FROM users WHERE id = ?', [id]))[0];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (req.user.role === 'manager' && target.role !== 'staff') {
    return res.status(403).json({ error: 'Managers may only delete staff accounts' });
  }
  await query('DELETE FROM users WHERE id = ?', [id]);
  await writeAudit(req.user.id, 'USER_DELETE', 'user', String(id), null, clientIp(req));
  return res.json({ ok: true });
}

export async function userStats(req, res) {
  const id = Number(req.params.id);
  if (req.user.role === 'staff' && id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const cpsSetting = await query(
    `SELECT setting_value FROM app_settings WHERE setting_key = 'commission_per_student' LIMIT 1`
  );
  const cps = Number(cpsSetting[0]?.setting_value ?? 750);
  const rows = await query(
    `SELECT u.id, u.name, u.email, u.role, u.base_salary, u.commission_rate,
      (SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) AS students_handled,
      (SELECT COUNT(*) FROM payments p WHERE p.staff_id = u.id) AS payments_collected_count,
      (SELECT COALESCE(SUM(amount_paid), 0) FROM payments p WHERE p.staff_id = u.id) AS total_collected,
      ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?) AS total_commission,
      ? AS commission_per_student
     FROM users u WHERE u.id = ?`,
    [cps, cps, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const row = rows[0];
  if (req.user.role === 'manager') {
    if (row.role !== 'staff') {
      return res.status(403).json({ error: 'Managers may only view staff performance' });
    }
  }
  return res.json(row);
}

export async function requestCredentialChange(req, res) {
  const { new_name, new_email, new_password, current_password } = req.body || {};
  if (!new_name && !new_email && !new_password) {
    return res.status(400).json({ error: 'Provide new_name and/or new_email and/or new_password' });
  }
  const existing = (await query('SELECT id, password, email FROM users WHERE id = ?', [req.user.id]))[0];
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (!current_password || !(await verifyPassword(current_password, existing.password))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  let name = null;
  let email = null;
  let pwHash = null;
  if (new_name && String(new_name).trim()) {
    name = String(new_name).trim();
  }
  if (new_email && new_email !== existing.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(new_email).trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const emailInUse = await query('SELECT id FROM users WHERE email = ? AND id != ?', [new_email, req.user.id]);
    if (emailInUse.length) return res.status(409).json({ error: 'Email already in use' });
    email = new_email;
  }
  if (new_password) {
    const pwErr = validateStrongPassword(new_password);
    if (pwErr) return res.status(400).json({ error: pwErr });
    pwHash = await hashPassword(new_password);
  }
  if (!name && !email && !pwHash) return res.status(400).json({ error: 'No changes detected' });

  const requiresApproval = req.user.role === 'manager' || req.user.role === 'staff';

  // Admin can apply credential changes immediately.
  if (!requiresApproval) {
    const fields = [];
    const params = [];
    if (name) {
      fields.push('name = ?');
      params.push(name);
    }
    if (email) {
      fields.push('email = ?');
      params.push(email);
    }
    if (pwHash) {
      fields.push('password = ?');
      params.push(pwHash);
    }
    params.push(req.user.id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    await writeAudit(
      req.user.id,
      'CREDENTIAL_CHANGE_DIRECT',
      'user',
      String(req.user.id),
      { nameChange: !!name, emailChange: !!email, passwordChange: !!pwHash },
      clientIp(req)
    );
    return res.status(200).json({ ok: true, message: 'Credentials updated successfully' });
  }

  // Staff/Manager: ALL credential updates require admin approval (name/email/password).
  const pending = await query(
    `SELECT id FROM credential_change_requests WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
    [req.user.id]
  );
  if (pending.length) {
    return res.status(409).json({ error: 'A credential change request is already pending admin approval' });
  }
  await query(
    `INSERT INTO credential_change_requests (user_id, new_name, new_email, new_password_hash, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [req.user.id, name, email, pwHash]
  );
  await writeAudit(
    req.user.id,
    'CREDENTIAL_CHANGE_REQUESTED',
    'user',
    String(req.user.id),
    { nameChange: !!name, emailChange: !!email, passwordChange: !!pwHash },
    clientIp(req)
  );

  return res.status(201).json({ ok: true, message: 'Request submitted for admin approval' });
}

export async function listCredentialRequests(req, res) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const rows = await query(
    `SELECT r.id, r.user_id, r.new_name, r.new_email, r.status, r.reason, r.created_at, r.reviewed_at,
            u.name AS user_name, u.email AS current_email,
            rv.name AS reviewed_by_name
     FROM credential_change_requests r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN users rv ON rv.id = r.reviewed_by
     ORDER BY r.id DESC`
  );
  res.json(rows);
}

export async function approveCredentialRequest(req, res) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = Number(req.params.id);
  const row = (
    await query(
      `SELECT id, user_id, new_name, new_email, new_password_hash, status FROM credential_change_requests WHERE id = ?`,
      [id]
    )
  )[0];
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Request already reviewed' });

  const fields = [];
  const params = [];
  if (row.new_name) {
    fields.push('name = ?');
    params.push(row.new_name);
  }
  if (row.new_email) {
    const emailInUse = await query('SELECT id FROM users WHERE email = ? AND id != ?', [row.new_email, row.user_id]);
    if (emailInUse.length) return res.status(409).json({ error: 'Email already in use' });
    fields.push('email = ?');
    params.push(row.new_email);
  }
  if (row.new_password_hash) {
    fields.push('password = ?');
    params.push(row.new_password_hash);
  }
  if (fields.length) {
    params.push(row.user_id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  await query(
    `UPDATE credential_change_requests
     SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), reason = NULL
     WHERE id = ?`,
    [req.user.id, id]
  );
  await writeAudit(req.user.id, 'CREDENTIAL_CHANGE_APPROVED', 'credential_change_requests', String(id), null, clientIp(req));
  res.json({ ok: true });
}

export async function rejectCredentialRequest(req, res) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = Number(req.params.id);
  const reason = String(req.body?.reason || '').slice(0, 255) || 'Rejected by admin';
  const row = (await query(`SELECT id, status FROM credential_change_requests WHERE id = ?`, [id]))[0];
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.status !== 'pending') return res.status(400).json({ error: 'Request already reviewed' });
  await query(
    `UPDATE credential_change_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), reason = ?
     WHERE id = ?`,
    [req.user.id, reason, id]
  );
  await writeAudit(req.user.id, 'CREDENTIAL_CHANGE_REJECTED', 'credential_change_requests', String(id), { reason }, clientIp(req));
  res.json({ ok: true });
}
