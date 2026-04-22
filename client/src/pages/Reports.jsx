import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';

export function Reports() {
  const { isAdmin, isManager, isStaff } = useAuth();
  const canFinancial = isAdmin || isManager;
  const canAdminTracking = isAdmin;
  const [tab, setTab] = useState(canFinancial ? 'course' : 'batch-payments');
  const [courseRev, setCourseRev] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchPayments, setBatchPayments] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);
  const [due, setDue] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [studentPay, setStudentPay] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [commissions, setCommissions] = useState([]);

  const load = useCallback(async () => {
    const batchPaymentRes = await api('/reports/batch-payment-summary');
    if (batchPaymentRes.ok) setBatchPayments(await parseJson(batchPaymentRes));

    if (canFinancial) {
      const [cr, br, idue] = await Promise.all([
        api('/reports/course-revenue'),
        api('/reports/batches'),
        api('/reports/installment-due'),
      ]);
      if (cr.ok) setCourseRev(await parseJson(cr));
      if (br.ok) setBatches(await parseJson(br));
      if (idue.ok) setDue(await parseJson(idue));
    } else {
      const idue = await api('/reports/installment-due');
      if (idue.ok) setDue(await parseJson(idue));
    }
    if (canAdminTracking) {
      const sp = await api('/reports/staff-performance');
      if (sp.ok) setStaffPerf(await parseJson(sp));
      const en = await api('/reports/enrollments');
      if (en.ok) setEnrollments(await parseJson(en));
      const cm = await api('/reports/staff-commissions');
      if (cm.ok) setCommissions(await parseJson(cm));
    } else {
      setStaffPerf([]);
      setEnrollments([]);
      setCommissions([]);
    }
    const st = await api('/students');
    if (st.ok) setStudents(await parseJson(st));
  }, [canFinancial, canAdminTracking]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!studentId || !canFinancial) return;
    (async () => {
      const res = await api(`/reports/student-payments?student_id=${studentId}`);
      if (res.ok) setStudentPay(await parseJson(res));
    })();
  }, [studentId, canFinancial]);

  const tabs = [];
  tabs.push({ id: 'batch-payments', label: 'Batch payments' });
  if (canFinancial) {
    tabs.push({ id: 'course', label: 'Course revenue' });
    tabs.push({ id: 'batch', label: 'Batch report' });
    tabs.push({ id: 'student', label: 'Student payments' });
    tabs.push({ id: 'installment', label: 'Installment due' });
  } else {
    tabs.push({ id: 'installment', label: 'Installment due' });
  }
  if (canAdminTracking) {
    tabs.push({ id: 'staff', label: 'Staff performance' });
    tabs.push({ id: 'enrollment', label: 'Enrollment tracker' });
    tabs.push({ id: 'commission', label: 'Commissions' });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500">Analytics in LKR</p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? 'bg-[#751c58] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'course' && canFinancial && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {courseRev.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.course_name}</td>
                  <td className="px-4 py-3">{formatLKR(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'batch-payments' && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Batch payment summary</h2>
            <p className="text-sm text-slate-500">
              {isStaff
                ? 'Showing only the batches linked to students you enrolled.'
                : 'Showing all batch payment summaries available for your role.'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Pending</th>
                </tr>
              </thead>
              <tbody>
                {batchPayments.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-4 py-3">{b.batch_name}</td>
                    <td className="px-4 py-3 capitalize">{b.status}</td>
                    <td className="px-4 py-3">{b.total_students}</td>
                    <td className="px-4 py-3">{formatLKR(b.total_collected)}</td>
                    <td className="px-4 py-3">{formatLKR(b.pending_payments)}</td>
                  </tr>
                ))}
                {!batchPayments.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No batch payment data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'batch' && canFinancial && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">{b.batch_name}</td>
                  <td className="px-4 py-3">{b.course_name}</td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                  <td className="px-4 py-3">{b.student_count}</td>
                  <td className="px-4 py-3">{formatLKR(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'student' && canFinancial && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <select
            className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Staff</th>
                </tr>
              </thead>
              <tbody>
                {studentPay.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{p.receipt_no}</td>
                    <td className="px-4 py-3">{formatLKR(p.amount_paid)}</td>
                    <td className="px-4 py-3">{p.payment_date}</td>
                    <td className="px-4 py-3">{p.staff_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'installment' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {due.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{d.student_name}</div>
                    <div className="text-xs text-slate-500">Reg No: {d.student_reg_no || '—'}</div>
                  </td>
                  <td className="px-4 py-3">{d.due_date}</td>
                  <td className="px-4 py-3">{formatLKR(d.installment_amount)}</td>
                  <td className="px-4 py-3 capitalize">{d.bucket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'staff' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Payments</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Base salary</th>
                <th className="px-4 py-3">Final salary</th>
              </tr>
            </thead>
            <tbody>
              {staffPerf.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{s.students_handled ?? '—'}</td>
                  <td className="px-4 py-3">{s.payment_count}</td>
                  <td className="px-4 py-3">{formatLKR(s.total_collected)}</td>
                  <td className="px-4 py-3">
                    {formatLKR(Number(s.students_handled || 0) * Number(s.commission_per_student || 0))}
                  </td>
                  <td className="px-4 py-3">{formatLKR(s.base_salary || 0)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {formatLKR(
                      Number(s.base_salary || 0) +
                        Number(s.students_handled || 0) * Number(s.commission_per_student || 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isStaff && (
            <p className="border-t px-4 py-3 text-xs text-slate-500">Showing your performance only.</p>
          )}
        </div>
      )}
      {tab === 'enrollment' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Enrolled by</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{e.name}</div>
                    <div className="text-xs text-slate-500">Reg No: {e.reg_no || '—'}</div>
                  </td>
                  <td className="px-4 py-3">{e.batch_name}</td>
                  <td className="px-4 py-3">
                    {e.enrolled_by_name || '—'} <span className="text-xs text-slate-500">({e.enrolled_by_role || '—'})</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'commission' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Students enrolled</th>
                <th className="px-4 py-3">Commission per student</th>
                <th className="px-4 py-3">Commission</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.students_enrolled || 0}</td>
                  <td className="px-4 py-3">{formatLKR(c.commission_per_student || 0)}</td>
                  <td className="px-4 py-3 font-semibold">{formatLKR(c.total_commission || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
