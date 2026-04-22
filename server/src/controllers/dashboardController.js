import { query } from '../config/db.js';
import { visibleStudentWhere } from '../utils/staffVisibility.js';

export async function stats(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const scope = visibleStudentWhere(req, 's');
  const staffWhere = scope.clause ? `WHERE ${scope.clause} AND` : 'WHERE';
  const staffParams = [...scope.params];

  const students = await query(
    scope.clause
      ? `SELECT COUNT(*) AS c FROM students s WHERE ${scope.clause}`
      : 'SELECT COUNT(*) AS c FROM students',
    staffParams
  );

  const [courses, batches, revenue, overdue, dueToday, fullPaid, installmentStudents, activeBatches, completedBatches] =
    await Promise.all([
      query('SELECT COUNT(*) AS c FROM courses'),
      query('SELECT COUNT(*) AS c FROM batches'),
      query(
        req.user.role === 'staff'
          ? `SELECT COALESCE(SUM(p.amount_paid),0) AS t FROM payments p WHERE p.staff_id = ?`
          : `SELECT COALESCE(SUM(amount_paid),0) AS t FROM payments`,
        req.user.role === 'staff' ? [req.user.id] : []
      ),
      query(
        scope.clause
          ? `SELECT COUNT(*) AS c FROM installments i
             JOIN students s ON s.id = i.student_id
             ${staffWhere} i.due_date < ? AND i.paid_amount < i.installment_amount AND i.status != 'paid'`
          : `SELECT COUNT(*) AS c FROM installments i
             WHERE i.due_date < ? AND i.paid_amount < i.installment_amount AND i.status != 'paid'`,
        scope.clause ? [...staffParams, today] : [today]
      ),
      query(
        scope.clause
          ? `SELECT COUNT(*) AS c FROM installments i
             JOIN students s ON s.id = i.student_id
             ${staffWhere} i.due_date = ? AND i.paid_amount < i.installment_amount`
          : `SELECT COUNT(*) AS c FROM installments i
             WHERE i.due_date = ? AND i.paid_amount < i.installment_amount`,
        scope.clause ? [...staffParams, today] : [today]
      ),
      query(
        scope.clause
          ? `SELECT COUNT(DISTINCT s.id) AS c FROM students s
             JOIN (SELECT student_id, SUM(amount_paid) AS paid FROM payments GROUP BY student_id) x ON x.student_id = s.id
             WHERE ${scope.clause} AND x.paid >= s.total_fee`
          : `SELECT COUNT(DISTINCT s.id) AS c FROM students s
             JOIN (SELECT student_id, SUM(amount_paid) AS paid FROM payments GROUP BY student_id) x ON x.student_id = s.id
             WHERE x.paid >= s.total_fee`,
        staffParams
      ),
      query(
        scope.clause
          ? `SELECT COUNT(*) AS c FROM students s WHERE s.payment_type = 'INSTALLMENT' AND ${scope.clause}`
          : `SELECT COUNT(*) AS c FROM students WHERE payment_type = 'INSTALLMENT'`,
        staffParams
      ),
      query(`SELECT COUNT(*) AS c FROM batches WHERE status = 'active'`),
      query(`SELECT COUNT(*) AS c FROM batches WHERE status = 'completed'`),
    ]);

  res.json({
    totalStudents: students[0].c,
    totalCourses: courses[0].c,
    totalBatches: batches[0].c,
    activeBatches: activeBatches[0].c,
    completedBatches: completedBatches[0].c,
    revenue: Number(revenue[0].t),
    overdueCount: overdue[0].c,
    dueTodayCount: dueToday[0].c,
    fullPaidStudents: fullPaid[0].c,
    installmentStudents: installmentStudents[0].c,
  });
}
