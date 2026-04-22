import { query } from '../config/db.js';

export async function writeAudit(userId, action, entityType = null, entityId = null, details = null, ip = null) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId != null ? String(entityId) : null,
        details ? JSON.stringify(details) : null,
        ip,
      ]
    );
  } catch (e) {
    console.error('audit write failed', e.message);
  }
}
