import { query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';
import { visibleStudentScope, visibleStudentWhere } from '../utils/staffVisibility.js';

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

export async function courseRevenue(_req, res) {
  const rows = await query(`
    SELECT c.id, c.course_name, COALESCE(SUM(p.amount_paid),0) AS revenue
    FROM courses c
    LEFT JOIN students s ON s.course_id = c.id
    LEFT JOIN payments p ON p.student_id = s.id
    GROUP BY c.id, c.course_name
    ORDER BY revenue DESC
  `);
  res.json(rows);
}

export async function batchReport(_req, res) {
  const rows = await query(`
    SELECT b.id, b.batch_name, b.status, b.start_date, b.end_date,
           (
             SELECT GROUP_CONCAT(DISTINCT c.course_name ORDER BY c.course_name SEPARATOR ' + ')
             FROM students s2
             JOIN courses c ON c.id = s2.course_id
             WHERE s2.batch_id = b.id
           ) AS course_name,
           COUNT(s.id) AS student_count,
           COALESCE(SUM(p.amount_paid),0) AS revenue
    FROM batches b
    LEFT JOIN students s ON s.batch_id = b.id
    LEFT JOIN payments p ON p.student_id = s.id
    GROUP BY b.id, b.batch_name, b.status, b.start_date, b.end_date
    ORDER BY b.start_date DESC
  `);
  res.json(rows);
}

/** Per-batch payment summary: students, collected, pending balance */
export async function batchPaymentSummary(req, res) {
  const staffScope = visibleStudentScope(req, 's');

  let sql;
  const params = [...staffScope.params];

  if (staffScope.clause) {
    sql = `
      SELECT b.id, b.batch_name, b.status, b.start_date, b.end_date,
        (
          SELECT GROUP_CONCAT(DISTINCT c.course_name ORDER BY c.course_name SEPARATOR ' + ')
          FROM students s2
          JOIN courses c ON c.id = s2.course_id
          WHERE s2.batch_id = b.id
            AND (s2.created_by = ? OR s2.created_by IN (SELECT id FROM users WHERE role = 'admin'))
        ) AS course_name,
        COUNT(DISTINCT s.id) AS total_students,
        COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS total_collected,
        COALESCE(SUM(GREATEST(0, s.total_fee - COALESCE(pay.total_paid, 0))), 0) AS pending_payments
      FROM batches b
      INNER JOIN students s ON s.batch_id = b.id ${staffScope.clause}
      LEFT JOIN (
        SELECT student_id, SUM(amount_paid) AS total_paid FROM payments GROUP BY student_id
      ) pay ON pay.student_id = s.id
      GROUP BY b.id, b.batch_name, b.status, b.start_date, b.end_date
      HAVING COUNT(DISTINCT s.id) > 0
      ORDER BY b.start_date DESC`;
    params.unshift(req.user.id);
  } else {
    sql = `
      SELECT b.id, b.batch_name, b.status, b.start_date, b.end_date,
        (
          SELECT GROUP_CONCAT(DISTINCT c.course_name ORDER BY c.course_name SEPARATOR ' + ')
          FROM students s2
          JOIN courses c ON c.id = s2.course_id
          WHERE s2.batch_id = b.id
        ) AS course_name,
        COUNT(DISTINCT s.id) AS total_students,
        COALESCE(SUM(COALESCE(pay.total_paid, 0)), 0) AS total_collected,
        COALESCE(SUM(GREATEST(0, s.total_fee - COALESCE(pay.total_paid, 0))), 0) AS pending_payments
      FROM batches b
      LEFT JOIN students s ON s.batch_id = b.id
      LEFT JOIN (
        SELECT student_id, SUM(amount_paid) AS total_paid FROM payments GROUP BY student_id
      ) pay ON pay.student_id = s.id
      GROUP BY b.id, b.batch_name, b.status, b.start_date, b.end_date
      ORDER BY b.start_date DESC`;
  }

  const rows = await query(sql, params);
  res.json(rows);
}

export async function studentPaymentHistory(req, res) {
  const { student_id } = req.query;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  const rows = await query(
    `SELECT p.*, s.name AS student_name, s.reg_no AS student_reg_no, u.name AS staff_name
     FROM payments p
     JOIN students s ON s.id = p.student_id
     JOIN users u ON u.id = p.staff_id
     WHERE p.student_id = ?
     ORDER BY p.payment_date DESC`,
    [student_id]
  );
  res.json(rows);
}

export async function staffPerformance(req, res) {
  const cpsSetting = await query(
    `SELECT setting_value FROM app_settings WHERE setting_key = 'commission_per_student' LIMIT 1`
  );
  const cps = Number(cpsSetting[0]?.setting_value ?? 750);
  let sql = `
    SELECT u.id, u.name, u.email, u.base_salary, u.commission_rate,
           (SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) AS students_handled,
           COUNT(p.id) AS payment_count,
           COALESCE(SUM(p.amount_paid),0) AS total_collected,
           ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?) AS total_commission,
           (COALESCE(u.base_salary, 0) + ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?)) AS final_salary,
           ? AS commission_per_student
    FROM users u
    LEFT JOIN payments p ON p.staff_id = u.id
    WHERE u.role IN ('staff','manager')
    GROUP BY u.id, u.name, u.email, u.base_salary, u.commission_rate
    ORDER BY total_collected DESC`;
  const params = [];
  params.push(cps, cps, cps);
  if (req.user.role === 'staff') {
    sql = `
      SELECT u.id, u.name, u.email, u.base_salary, u.commission_rate,
             (SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) AS students_handled,
             COUNT(p.id) AS payment_count,
             COALESCE(SUM(p.amount_paid),0) AS total_collected,
             ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?) AS total_commission,
             (COALESCE(u.base_salary, 0) + ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?)) AS final_salary,
             ? AS commission_per_student
      FROM users u
      LEFT JOIN payments p ON p.staff_id = u.id AND p.staff_id = ?
      WHERE u.id = ?
      GROUP BY u.id, u.name, u.email, u.base_salary, u.commission_rate`;
    params.length = 0;
    params.push(cps, cps, cps, req.user.id, req.user.id);
  }
  const rows = await query(sql, params);
  rows.forEach((r) => {
    const expected = Number(r.students_handled || 0) * Number(r.commission_per_student || 0);
    if (Number(r.total_commission || 0) !== expected) {
      writeAudit(
        req.user.id,
        'COMMISSION_VALIDATION_WARNING',
        'commission',
        String(r.id),
        { expected, actual: Number(r.total_commission || 0) },
        ip(req)
      ).catch(() => {});
    }
  });
  res.json(rows);
}

export async function installmentDueReport(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const scope = visibleStudentScope(req, 's');
  let sql = `
    SELECT i.*, s.name AS student_name, s.reg_no AS student_reg_no, s.phone, s.whatsapp_no, s.address
    FROM installments i
    JOIN students s ON s.id = i.student_id
    WHERE i.status != 'paid' AND i.paid_amount < i.installment_amount`;
  const params = [...scope.params];
  sql += scope.clause;
  sql += ' ORDER BY i.due_date ASC';
  const rows = await query(sql, params);
  const mapped = rows.map((row) => ({
    ...row,
    bucket:
      row.due_date < today ? 'overdue' : row.due_date === today ? 'due_today' : 'upcoming',
  }));
  res.json(mapped);
}

export async function auditReport(req, res) {
  const { from, to, limit = 200 } = req.query;
  let sql = `
    SELECT a.*, u.name AS user_name, u.email AS user_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE 1=1`;
  const params = [];
  if (from) {
    sql += ' AND a.created_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND a.created_at <= ?';
    params.push(to);
  }
  sql += ' ORDER BY a.id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 1000));
  const rows = await query(sql, params);
  res.json(rows);
}

export async function enrollmentTracking(req, res) {
  const search = req.query.search;
  const status = req.query.status;
  const scope = visibleStudentScope(req, 's');
  let sql = `
    SELECT s.id, s.name, s.reg_no, s.phone, s.whatsapp_no, s.status, s.enrollment_date, s.dropout_date,
           s.dropout_reason, c.course_name, b.batch_name,
           u.id AS enrolled_by_id, u.name AS enrolled_by_name, u.role AS enrolled_by_role
    FROM students s
    JOIN courses c ON c.id = s.course_id
    JOIN batches b ON b.id = s.batch_id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE 1=1`;
  const params = [...scope.params];
  sql += scope.clause;
  if (status === 'active' || status === 'dropout') {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND (s.name LIKE ? OR u.name LIKE ? OR b.batch_name LIKE ?)';
    params.push(q, q, q);
  }
  sql += ' ORDER BY s.id DESC';
  const rows = await query(sql, params);
  res.json(rows);
}

export async function staffCommissions(req, res) {
  const cpsSetting = await query(
    `SELECT setting_value FROM app_settings WHERE setting_key = 'commission_per_student' LIMIT 1`
  );
  const cps = Number(cpsSetting[0]?.setting_value ?? 750);
  let sql = `
    SELECT u.id, u.name, u.email, ? AS commission_per_student,
           (SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) AS students_enrolled,
           ((SELECT COUNT(*) FROM students s WHERE s.created_by = u.id) * ?) AS total_commission
    FROM users u
    WHERE u.role = 'staff'`;
  const params = [cps, cps];
  if (req.user.role === 'staff') {
    sql += ' AND u.id = ?';
    params.push(req.user.id);
  }
  sql += ' GROUP BY u.id, u.name, u.email ORDER BY total_commission DESC';
  const rows = await query(sql, params);
  res.json(rows);
}
