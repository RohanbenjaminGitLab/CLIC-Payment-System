import { query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

async function getSetting(key, fallback = null) {
  const rows = await query(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`, [key]);
  return rows[0]?.setting_value ?? fallback;
}

async function upsertSetting(key, value, userId) {
  await query(
    `INSERT INTO app_settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
    [key, value, userId]
  );
}

export async function getSettings(req, res) {
  const [commissionPerStudent] = await Promise.all([
    getSetting('commission_per_student', '750'),
  ]);
  res.json({
    appName: process.env.APP_NAME || 'CLIC Campus',
    sessionTimeoutMinutes: Number(process.env.INACTIVITY_MINUTES || 30),
    commissionPerStudent: Number(commissionPerStudent || 0),
    role: req.user.role,
  });
}

export async function updateCommissionPerStudent(req, res) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const value = Number(req.body?.commission_per_student);
  if (Number.isNaN(value) || value < 0) {
    return res.status(400).json({ error: 'commission_per_student must be a non-negative number' });
  }
  await upsertSetting('commission_per_student', String(value), req.user.id);
  await writeAudit(
    req.user.id,
    'COMMISSION_PER_STUDENT_UPDATE',
    'settings',
    'commission_per_student',
    { commission_per_student: value },
    clientIp(req)
  );
  res.json({ ok: true, commission_per_student: value });
}
