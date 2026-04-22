import { query } from '../config/db.js';
import { visibleStudentScope } from '../utils/staffVisibility.js';

function staffStudentCheck(req, studentId) {
  return visibleStudentScope(req, 's').clause;
}

function staffParam(req, studentId) {
  return [studentId, ...visibleStudentScope(req, 's').params];
}

export async function listByStudent(req, res) {
  const studentId = req.params.studentId;
  let sql = `
    SELECT i.* FROM installments i
    JOIN students s ON s.id = i.student_id
    WHERE i.student_id = ?`;
  sql += staffStudentCheck(req);
  sql += ' ORDER BY i.due_date ASC';
  const rows = await query(sql, staffParam(req, studentId));
  const today = new Date().toISOString().slice(0, 10);
  const enriched = rows.map((row) => {
    let alert = 'upcoming';
    if (row.status === 'paid') alert = 'paid';
    else if (row.due_date < today && Number(row.paid_amount) < Number(row.installment_amount)) {
      alert = 'overdue';
    } else if (row.due_date === today) alert = 'due_today';
    else if (row.due_date > today) alert = 'upcoming';
    return { ...row, alert };
  });
  res.json(enriched);
}

export async function listAlerts(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  let sql = `
    SELECT i.*, s.name AS student_name, s.reg_no AS student_reg_no, s.phone
    FROM installments i
    JOIN students s ON s.id = i.student_id
    WHERE i.status != 'paid' AND i.paid_amount < i.installment_amount`;
  const scope = visibleStudentScope(req, 's');
  const params = [...scope.params];
  sql += scope.clause;
  sql += ' ORDER BY i.due_date ASC';
  const rows = await query(sql, params);
  const mapped = rows.map((row) => {
    let badge = 'upcoming';
    if (row.due_date < today) badge = 'overdue';
    else if (row.due_date === today) badge = 'due_today';
    else badge = 'upcoming';
    return { ...row, badge };
  });
  res.json(mapped);
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('94')) return digits;
  if (digits.startsWith('0')) return `94${digits.slice(1)}`;
  return digits;
}

export async function whatsappReminders(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  let sql = `
    SELECT i.id, i.student_id, i.due_date, i.installment_amount, i.paid_amount,
           s.name AS student_name, s.reg_no AS student_reg_no, COALESCE(s.whatsapp_no, s.phone) AS contact_no
    FROM installments i
    JOIN students s ON s.id = i.student_id
    WHERE i.status != 'paid' AND i.paid_amount < i.installment_amount AND i.due_date <= ?`;
  const scope = visibleStudentScope(req, 's');
  const params = [today, ...scope.params];
  sql += scope.clause;
  sql += ' ORDER BY i.due_date ASC';
  const rows = await query(sql, params);
  const reminders = rows
    .map((row) => {
      const remaining = Math.max(0, Number(row.installment_amount) - Number(row.paid_amount));
      const phone = normalizePhone(row.contact_no);
      if (!phone || remaining <= 0) return null;
      const msg =
        `Hello ${row.student_name}, this is a payment reminder from CLIC Campus. ` +
        `Due amount: LKR ${remaining.toFixed(2)}. Due date: ${row.due_date}. Please pay on time.`;
      return {
        installment_id: row.id,
        student_id: row.student_id,
        student_name: row.student_name,
        student_reg_no: row.student_reg_no,
        due_date: row.due_date,
        due_amount: remaining,
        whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      };
    })
    .filter(Boolean);
  res.json(reminders);
}
