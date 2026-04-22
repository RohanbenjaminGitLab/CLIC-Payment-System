import validator from 'validator';
import { query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';
import { visibleStudentScope } from '../utils/staffVisibility.js';

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function ownedStudentScope(req, alias = 's') {
  return visibleStudentScope(req, alias);
}

async function nextReceiptNo() {
  const year = new Date().getFullYear();
  const rows = await query(
    `SELECT receipt_no FROM payments WHERE receipt_no LIKE ? ORDER BY id DESC LIMIT 1`,
    [`RCPT/${year}/%`]
  );
  let n = 1;
  if (rows.length) {
    const parts = rows[0].receipt_no.split('/');
    const last = parseInt(parts[2], 10);
    if (!Number.isNaN(last)) n = last + 1;
  }
  return `RCPT/${year}/${String(n).padStart(4, '0')}`;
}

async function applyInstallments(studentId, amount) {
  let remaining = Number(amount);
  const inst = await query(
    `SELECT * FROM installments WHERE student_id = ? AND (status IN ('pending','partial','overdue')) ORDER BY due_date ASC`,
    [studentId]
  );
  for (const row of inst) {
    if (remaining <= 0) break;
    const due = Number(row.installment_amount);
    const paid = Number(row.paid_amount);
    const need = due - paid;
    if (need <= 0) continue;
    const add = Math.min(remaining, need);
    const newPaid = paid + add;
    let status = 'partial';
    if (newPaid >= due) status = 'paid';
    else if (newPaid > 0) status = 'partial';
    await query(
      `UPDATE installments SET paid_amount = ?, status = ? WHERE id = ?`,
      [newPaid, status, row.id]
    );
    remaining -= add;
  }
  await recalcInstallmentOverdue(studentId);
}

async function recalcInstallmentOverdue(studentId) {
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `UPDATE installments SET status = 'overdue'
     WHERE student_id = ? AND due_date < ? AND paid_amount < installment_amount AND status != 'paid'`,
    [studentId, today]
  );
}

export async function collect(req, res) {
  const { student_id, amount_paid, payment_date, notes } = req.body;
  if (!student_id || amount_paid == null || !payment_date) {
    return res.status(400).json({ error: 'student_id, amount_paid, payment_date required' });
  }
  if (Number.isNaN(Number(amount_paid)) || Number(amount_paid) <= 0) {
    return res.status(400).json({ error: 'amount_paid must be a valid positive number' });
  }

  const safeNotes =
    notes != null && String(notes).trim() !== ''
      ? validator.escape(String(notes).trim().slice(0, 240))
      : null;

  let scope = 'SELECT id, payment_type, total_fee, status FROM students WHERE id = ?';
  const sp = [student_id];
  if (req.user.role === 'staff') {
    scope += " AND (created_by = ? OR created_by IN (SELECT id FROM users WHERE role = 'admin'))";
    sp.push(req.user.id);
  }
  const st = await query(scope, sp);
  if (!st.length) return res.status(404).json({ error: 'Student not found' });
  if (st[0].status === 'dropout') return res.status(400).json({ error: 'Cannot accept payment for dropout student' });

  const receipt_no = await nextReceiptNo();
  const staff_id = req.user.id;

  const r = await query(
    `INSERT INTO payments (student_id, amount_paid, payment_date, staff_id, receipt_no, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [student_id, amount_paid, payment_date, staff_id, receipt_no, safeNotes]
  );

  if (st[0].payment_type === 'INSTALLMENT') {
    await applyInstallments(student_id, amount_paid);
  }
  // Commission is calculated per-student enrollment via reports/settings.

    const [info] = await query(
      `SELECT s.name AS student_name, s.reg_no AS student_reg_no, s.phone AS student_phone, s.total_fee, 
              s.discount_type, s.discount_value, b.batch_name, 
              (SELECT GROUP_CONCAT(c.course_name SEPARATOR ' + ') 
               FROM courses c 
               WHERE FIND_IN_SET(c.id, s.course_id) OR s.course_combo_code LIKE CONCAT('%', c.course_code, '%')) AS course_name
       FROM students s
       LEFT JOIN batches b ON s.batch_id = b.id
       WHERE s.id = ?`,
      [student_id]
    );
  const paidSum = await query(`SELECT COALESCE(SUM(amount_paid),0) AS t FROM payments WHERE student_id = ?`, [
    student_id,
  ]);
  const balance = Math.max(0, Number(info?.total_fee || 0) - Number(paidSum[0].t));

  await writeAudit(req.user.id, 'PAYMENT_COLLECT', 'payment', String(r.insertId), { student_id, receipt_no }, ip(req));

  return res.status(201).json({
    id: r.insertId,
    receipt_no,
      student_name: info?.student_name,
      student_reg_no: info?.student_reg_no,
      student_phone: info?.student_phone,
      batch_name: info?.batch_name,
      course_name: info?.course_name,
      total_fee: info?.total_fee,
      amount_paid: Number(amount_paid),
    balance,
    payment_date,
    currency: 'LKR',
  });
}

export async function list(req, res) {
  const scope = ownedStudentScope(req);
  let sql = `
    SELECT p.*, s.name AS student_name, s.reg_no AS student_reg_no, s.batch_id, b.batch_name, u.name AS staff_name,
           s.status AS student_status,
           (SELECT GROUP_CONCAT(c.course_name SEPARATOR ' + ') 
            FROM courses c 
            WHERE FIND_IN_SET(c.id, s.course_id) OR s.course_combo_code LIKE CONCAT('%', c.course_code, '%')) AS course_name
    FROM payments p
    JOIN students s ON p.student_id = s.id
    LEFT JOIN batches b ON s.batch_id = b.id
    LEFT JOIN users u ON p.staff_id = u.id
    WHERE 1=1`;
  const params = [...scope.params];
  if (scope.clause) {
    sql += scope.clause;
  }
  if (req.query.student_id) {
    sql += ' AND p.student_id = ?';
    params.push(req.query.student_id);
  }
  if (req.query.batch_id) {
    sql += ' AND s.batch_id = ?';
    params.push(req.query.batch_id);
  }
  sql += ' ORDER BY p.payment_date DESC, p.id DESC LIMIT 500';
  const rows = await query(sql, params);
  res.json(rows);
}

export async function historyForStudent(req, res) {
  const studentId = req.params.studentId;
  const scope = ownedStudentScope(req);
  const ok = await query(
    `SELECT id FROM students s WHERE id = ?${scope.clause}`,
    [studentId, ...scope.params]
  );
  if (!ok.length) return res.status(404).json({ error: 'Student not found' });

  const rows = await query(
    `SELECT p.*, u.name AS staff_name FROM payments p JOIN users u ON u.id = p.staff_id
     WHERE p.student_id = ? ORDER BY p.payment_date DESC`,
    [studentId]
  );
  res.json(rows);
}

export async function receipt(req, res) {
  const scope = ownedStudentScope(req);
  const [row] = await query(
    `
    SELECT p.*, s.name AS student_name, s.reg_no AS student_reg_no, s.phone AS student_phone, s.whatsapp_no, s.address, s.total_fee,
           s.discount_type, s.discount_value, s.status AS student_status,
           b.batch_name, u.name AS staff_name,
           (SELECT GROUP_CONCAT(c.course_name SEPARATOR ' + ') 
            FROM courses c 
            WHERE FIND_IN_SET(c.id, s.course_id) OR s.course_combo_code LIKE CONCAT('%', c.course_code, '%')) AS course_name
    FROM payments p
    JOIN students s ON p.student_id = s.id
    LEFT JOIN batches b ON s.batch_id = b.id
    LEFT JOIN users u ON p.staff_id = u.id
    WHERE p.id = ?${scope.clause}`,
    [req.params.id, ...scope.params]
  );
  if (!row) return res.status(404).json({ error: 'Receipt not found' });
  const paidSum = await query(`SELECT COALESCE(SUM(amount_paid),0) AS t FROM payments WHERE student_id = ?`, [
    row.student_id,
  ]);
  const totalPaid = Number(paidSum[0].t);
  const balance = Math.max(0, Number(row.total_fee) - totalPaid);
  res.json({
    student_id: row.student_id,
    receipt_no: row.receipt_no,
      title: process.env.APP_NAME || 'CLIC Campus',
      student_name: row.student_name,
      student_reg_no: row.student_reg_no,
      student_phone: row.student_phone,
      student_address: row.address,
      batch_name: row.batch_name,
      course_name: row.course_name,
      total_fee: row.total_fee,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      amount_paid: row.amount_paid,
    payment_date: row.payment_date,
    staff_name: row.staff_name,
    balance,
    student_whatsapp: row.whatsapp_no,
    student_address: row.address,
    receipt_footer: 'Enjoy the best in learning',
    receipt_logo_url: null,
    receipt_template_url: null,
  });
}
