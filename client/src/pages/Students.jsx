import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';
import { dayjs } from '../dayjs.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function Students() {
  const { isAdmin } = useAuth();
  const canDelete = isAdmin;
  const [deleteId, setDeleteId] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsapp_no: '',
    address: '',
    course_id: '',
    preferred_timing: '',
    preferred_schedule: '',
    batch_id: '',
    total_fee: '',
    discount_type: '',
    discount_value: '',
    payment_type: 'FULL',
    installment_count: '3',
    enrollment_date: new Date().toISOString().slice(0, 10),
    installments: [],
    selected_course_ids: [],
  });

  const phoneOk = (v) => !v || /^\+?[0-9][0-9\s-]{7,19}$/.test(String(v).trim());

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    if (statusFilter) q.set('status', statusFilter);
    const res = await api(`/students?${q.toString()}`);
    if (res.ok) setRows(await parseJson(res));
    const [cRes, bRes] = await Promise.all([api('/courses'), api('/batches')]);
    if (cRes.ok) setCourses(await parseJson(cRes));
    if (bRes.ok) setBatches(await parseJson(bRes));
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const availableBatches = (timing, schedule) =>
    batches.filter((b) => 
      (!timing || String(b.timing) === String(timing)) && 
      (!schedule || String(b.schedule) === String(schedule))
    );

  const totalForSelectedCourses = (ids) =>
    (ids || [])
      .map((id) => courses.find((c) => String(c.id) === String(id)))
      .filter(Boolean)
      .reduce((sum, c) => sum + Number(c.fee || 0), 0);

  /** Mirror of the backend normalizeCourseToken — must stay in sync */
  const normalizeToken = (courseName, courseCode) => {
    const known = { english: 'E', it: 'I', sinhala: 'S' };
    const byName = known[String(courseName || '').trim().toLowerCase()];
    if (byName) return byName;
    const byCode = known[String(courseCode || '').trim().toLowerCase()];
    if (byCode) return byCode;
    const text = String(courseName || courseCode || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return text ? text[0] : '';
  };

  const courseCodePreview = (ids) => {
    const order = { E: 1, I: 2, S: 3 };
    const tokens = (ids || [])
      .map((id) => courses.find((c) => String(c.id) === String(id)))
      .filter(Boolean)
      .map((c) => normalizeToken(c.course_name, c.course_code))
      .filter(Boolean)
      .sort((a, b) => {
        const ao = order[a] ?? 999;
        const bo = order[b] ?? 999;
        if (ao !== bo) return ao - bo;
        return String(a).localeCompare(String(b));
      });
    return [...new Set(tokens)].join('');
  };

  const calculateFee = (courseIds, dType, dValue) => {
    let baseFee = totalForSelectedCourses(courseIds);
    if (dType === 'FIXED') {
      baseFee = Math.max(0, baseFee - Number(dValue || 0));
    } else if (dType === 'PERCENTAGE') {
      baseFee = Math.max(0, baseFee - (baseFee * (Number(dValue || 0) / 100)));
    }
    return baseFee;
  };

  /**
   * Called whenever the multi-select changes.
   * This is the SINGLE source of truth for course selection.
   * It also updates course_id (for batch filtering) and total_fee.
   */
  const handleCourseSelection = (selectedIds) => {
    const primary = selectedIds[0] ?? '';
    const feeTotal = calculateFee(selectedIds, form.discount_type, form.discount_value);
    setForm((prev) => ({
      ...prev,
      selected_course_ids: selectedIds,
      // course_id is still tracked for the primary course, but batch_id is independent
      course_id: primary !== '' ? primary : prev.course_id,
      total_fee: feeTotal >= 0 ? feeTotal : prev.total_fee,
    }));
  };

  const handleDiscountChange = (dType, dValue) => {
    const feeTotal = calculateFee(form.selected_course_ids, dType, dValue);
    setForm(prev => ({ ...prev, discount_type: dType, discount_value: dValue, total_fee: feeTotal }));
  };

  const addInstallmentRow = () => {
    setForm((prev) => ({
      ...prev,
      installments: [...prev.installments, { installment_amount: '', due_date: '' }],
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.selected_course_ids.length || !form.batch_id || !form.enrollment_date) {
      return toast.error('Please fill all required fields (including at least one course)');
    }
    if (!phoneOk(form.phone) || !phoneOk(form.whatsapp_no)) {
      return toast.error('Invalid phone/WhatsApp format');
    }
    if (Number.isNaN(Number(form.total_fee || 0)) || Number(form.total_fee || 0) < 0) {
      return toast.error('Total fee must be a valid number');
    }

    // Derive course_id from first selected course (keeps backend happy)
    const primaryCourseId = form.selected_course_ids[0];

    const body = {
      name: form.name,
      phone: form.phone,
      whatsapp_no: form.whatsapp_no,
      address: form.address,
      course_id: Number(primaryCourseId),
      batch_id: Number(form.batch_id),
      total_fee: Number(form.total_fee || 0),
      discount_type: form.discount_type || null,
      discount_value: form.discount_type ? Number(form.discount_value || 0) : null,
      payment_type: form.payment_type,
      installment_count: Number(form.installment_count || 0),
      enrollment_date: form.enrollment_date,
      status: form.status || 'active',
      dropout_date: form.dropout_date || null,
      dropout_reason: form.dropout_reason || null,
      // Send ALL selected course IDs — this drives the combo code (EI, EIS, etc.)
      selected_course_ids: form.selected_course_ids
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0),
    };

    if (form.payment_type === 'INSTALLMENT') {
      body.installments = form.installments
        .filter((i) => i.installment_amount && i.due_date)
        .map((i) => ({
          installment_amount: Number(i.installment_amount),
          due_date: i.due_date,
        }));
    }

    if (modal === 'create') {
      const res = await api('/students', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return alert((await parseJson(res))?.error || 'Failed');
    } else {
      const res = await api(`/students/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      if (!res.ok) return alert((await parseJson(res))?.error || 'Failed');
    }
    setModal(null);
    load();
  };

  const confirmRemove = async () => {
    if (!deleteId) return;
    const res = await api(`/students/${deleteId}`, { method: 'DELETE' });
    const data = await parseJson(res);
    setDeleteId(null);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success('Student removed');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500">Enrollment and payment type</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const firstCourse = courses[0];
            setForm({
              name: '',
              phone: '',
              whatsapp_no: '',
              address: '',
              course_id: firstCourse?.id || '',
              preferred_timing: '',
              preferred_schedule: '',
              batch_id: '',
              total_fee: firstCourse?.fee ?? '',
              discount_type: '',
              discount_value: '',
              payment_type: 'FULL',
              installment_count: '3',
              status: 'active',
              dropout_date: '',
              dropout_reason: '',
              enrollment_date: new Date().toISOString().slice(0, 10),
              installments: [],
              selected_course_ids: firstCourse?.id ? [firstCourse.id] : [],
            });
            setModal('create');
          }}
          className="rounded-lg bg-[#751c58] px-4 py-2 text-sm font-semibold text-white"
        >
          Add student
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="dropout">Dropout</option>
          </select>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Student Name</th>
              <th className="px-4 py-3">Course / Batch</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Course Fee</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Enrolled by</th>
              <th className="px-4 py-3">Enrolled</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Reg No: {s.reg_no || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{s.selected_courses || s.course_name}</div>
                  <div className="text-xs text-slate-500">{s.batch_name}</div>
                </td>
                <td className="px-4 py-3">{s.payment_type}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{s.phone || '—'}</div>
                  <div>{s.whatsapp_no || '—'}</div>
                </td>
                <td className="px-4 py-3">{formatLKR(s.total_fee)}</td>
                <td className="px-4 py-3 capitalize">{s.status || 'active'}</td>
                <td className="px-4 py-3">{s.enrolled_staff_name || '—'}</td>
                <td className="px-4 py-3">
                  {s.enrollment_date ? dayjs(s.enrollment_date).format('DD MMM YYYY') : '—'}
                </td>
                <td className="space-x-2 px-4 py-3">
                  <button
                    type="button"
                    className="text-[#751c58]"
                    onClick={() => {
                      const existingIds = s.selected_course_ids
                        ? String(s.selected_course_ids)
                            .split(',')
                            .map((v) => Number(v))
                            .filter((v) => Number.isInteger(v) && v > 0)
                        : [s.course_id].filter(Boolean);
                      setForm({
                        id: s.id,
                        name: s.name,
                        phone: s.phone || '',
                        whatsapp_no: s.whatsapp_no || '',
                        address: s.address || '',
                        course_id: s.course_id,
                        preferred_timing: batches.find((b) => String(b.id) === String(s.batch_id))?.timing || '',
                        preferred_schedule: batches.find((b) => String(b.id) === String(s.batch_id))?.schedule || '',
                        batch_id: s.batch_id,
                        total_fee: s.total_fee,
                        discount_type: s.discount_type || '',
                        discount_value: s.discount_value || '',
                        payment_type: s.payment_type,
                        installment_count: s.installment_count || '3',
                        status: s.status || 'active',
                        dropout_date: s.dropout_date ? s.dropout_date.slice(0, 10) : '',
                        dropout_reason: s.dropout_reason || '',
                        enrollment_date: s.enrollment_date?.slice(0, 10),
                        installments: [],
                        selected_course_ids: existingIds,
                      });
                      setModal('edit');
                    }}
                  >
                    Edit
                  </button>
                  {s.status !== 'dropout' && (
                    <button
                      type="button"
                      className="text-amber-700"
                      onClick={async () => {
                        const res = await api(`/students/${s.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            status: 'dropout',
                            dropout_date: new Date().toISOString().slice(0, 10),
                          }),
                        });
                        const data = await parseJson(res);
                        if (!res.ok) return toast.error(data?.error || 'Failed');
                        if (data?.student?.status !== 'dropout') {
                          return toast.error('Student status was not updated. Please try again.');
                        }
                        setRows((prev) =>
                          prev.map((row) => (row.id === s.id ? { ...row, ...data.student } : row))
                        );
                        toast.success('Marked as dropout');
                        load();
                      }}
                    >
                      Dropout Student
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                      onClick={() => setDeleteId(s.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{modal === 'create' ? 'Add student' : 'Edit student'}</h2>
            <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="WhatsApp number"
                value={form.whatsapp_no}
                onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_no: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              />

              {/* ── MULTI-SELECT: primary and only course picker ──────────────────── */}
              <label className="block text-xs font-medium text-slate-600">
                Select course(s) — hold Ctrl / Cmd for multiple
              </label>
              <select
                multiple
                className="h-28 w-full rounded-lg border px-3 py-2 text-sm"
                value={(form.selected_course_ids || []).map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                  handleCourseSelection(selected);
                }}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_name}
                  </option>
                ))}
              </select>

              {/* Live preview of the generated code */}
              <p className="text-xs font-semibold text-[#751c58]">
                Student ID preview:{' '}
                {form.selected_course_ids.length
                  ? `CL/${courseCodePreview(form.selected_course_ids)}/${
                      form.enrollment_date
                        ? `${String(new Date(form.enrollment_date).getFullYear()).slice(-2)}${String(
                            new Date(form.enrollment_date).getMonth() + 1
                          ).padStart(2, '0')}`
                        : 'YYMM'
                    }/XXXXX`
                  : '— pick at least one course —'}
              </p>

              {/* Batch selector — filtered ONLY by timing and schedule */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={form.preferred_timing || ''}
                    onChange={(e) => {
                      const t = e.target.value;
                      const available = availableBatches(t, form.preferred_schedule);
                      setForm((prev) => ({ ...prev, preferred_timing: t, batch_id: available[0]?.id || '' }));
                    }}
                  >
                    <option value="">Any time</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Schedule</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={form.preferred_schedule || ''}
                    onChange={(e) => {
                      const s = e.target.value;
                      const available = availableBatches(form.preferred_timing, s);
                      setForm((prev) => ({ ...prev, preferred_schedule: s, batch_id: available[0]?.id || '' }));
                    }}
                  >
                    <option value="">Any schedule</option>
                    <option value="WEEKDAY">Weekday</option>
                    <option value="WEEKEND">Weekend</option>
                  </select>
                </div>
              </div>

              <label className="block text-xs font-medium text-slate-600">Select Batch</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.batch_id}
                onChange={(e) => setForm((prev) => ({ ...prev, batch_id: e.target.value }))}
              >
                <option value="">Select batch</option>
                {availableBatches(form.preferred_timing, form.preferred_schedule).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_name}
                  </option>
                ))}
              </select>

              {/* Discount Section */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Base Course Fee:</span>
                  <span className="font-semibold text-slate-800">{formatLKR(totalForSelectedCourses(form.selected_course_ids))}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Discount Type</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={form.discount_type || ''}
                      onChange={(e) => handleDiscountChange(e.target.value, form.discount_value)}
                    >
                      <option value="">No Discount</option>
                      <option value="FIXED">Fixed Amount (LKR)</option>
                      <option value="PERCENTAGE">Percentage (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Discount Value</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="0"
                      value={form.discount_value}
                      disabled={!form.discount_type}
                      onChange={(e) => handleDiscountChange(form.discount_type, e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                  <span className="text-slate-600 font-medium">Final Payment Amount:</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-[#751c58]">{formatLKR(form.total_fee)}</span>
                  </div>
                </div>
              </div>


              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.payment_type}
                onChange={(e) => setForm((prev) => ({ ...prev, payment_type: e.target.value }))}
              >
                <option value="FULL">FULL</option>
                <option value="INSTALLMENT">INSTALLMENT</option>
              </select>
              <input
                type="date"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.enrollment_date}
                onChange={(e) => setForm((prev) => ({ ...prev, enrollment_date: e.target.value }))}
              />
              {form.payment_type === 'INSTALLMENT' && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={form.installment_count || '3'}
                    onChange={(e) => setForm((prev) => ({ ...prev, installment_count: e.target.value }))}
                  >
                    <option value="2">2 installments</option>
                    <option value="3">3 installments</option>
                    <option value="4">4 installments</option>
                    <option value="5">5 installments</option>
                  </select>
                  <div className="text-xs text-slate-600">
                    Auto schedule dates:
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.from({ length: Number(form.installment_count || 0) }).map((_, i) => {
                        const d = new Date(form.enrollment_date || new Date());
                        d.setMonth(d.getMonth() + i);
                        return (
                          <span key={i} className="rounded bg-slate-100 px-2 py-0.5">
                            {dayjs(d).format('DD MMM YYYY')}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.status || 'active'}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="dropout">Dropout</option>
              </select>
              {form.status === 'dropout' && (
                <>
                  <input
                    type="date"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={form.dropout_date || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, dropout_date: e.target.value }))}
                  />
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Dropout reason"
                    value={form.dropout_reason || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, dropout_reason: e.target.value }))}
                  />
                </>
              )}
              {form.payment_type === 'INSTALLMENT' && modal === 'create' && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Installment schedule</span>
                    <button type="button" className="text-sm text-indigo-600" onClick={addInstallmentRow}>
                      + Add row
                    </button>
                  </div>
                  {form.installments.map((row, idx) => (
                    <div key={idx} className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        className="rounded border px-2 py-1 text-sm"
                        placeholder="Amount"
                        value={row.installment_amount}
                        onChange={(e) => {
                          const installments = [...form.installments];
                          installments[idx] = { ...row, installment_amount: e.target.value };
                          setForm((prev) => ({ ...prev, installments }));
                        }}
                      />
                      <input
                        type="date"
                        className="rounded border px-2 py-1 text-sm"
                        value={row.due_date}
                        onChange={(e) => {
                          const installments = [...form.installments];
                          installments[idx] = { ...row, due_date: e.target.value };
                          setForm((prev) => ({ ...prev, installments }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#751c58] px-4 py-2 text-sm text-white"
                onClick={save}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete student?"
        message="Are you sure you want to delete this record? This action cannot be undone."
        onConfirm={confirmRemove}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
