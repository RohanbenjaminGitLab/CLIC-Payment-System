import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';
import { generateReceiptPdf } from '../utils/receiptPdf.js';
import { buildWhatsAppReceiptUrl } from '../utils/whatsapp.js';
import { dayjs } from '../dayjs.js';

export function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const batchFromUrl = searchParams.get('batch');

  const [batches, setBatches] = useState([]);
  /** Primary batch filter: drives student list, collect dropdown, and payment history */
  const [activeBatch, setActiveBatch] = useState(batchFromUrl || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [batchStudents, setBatchStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState({
    student_id: '',
    amount_paid: '',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [history, setHistory] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [balance, setBalance] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setActiveBatch(batchFromUrl || '');
  }, [batchFromUrl]);

  const loadBatches = async () => {
    const res = await api('/batches');
    if (res.ok) setBatches(await parseJson(res));
  };

  const loadPayments = useCallback(async () => {
    const q = activeBatch ? `?batch_id=${encodeURIComponent(activeBatch)}` : '';
    const res = await api(`/payments${q}`);
    if (res.ok) setPayments(await parseJson(res));
  }, [activeBatch]);

  const loadBatchStudents = useCallback(async () => {
    if (!activeBatch) {
      setBatchStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const q = new URLSearchParams({ batch_id: activeBatch });
      if (studentSearch.trim()) q.set('search', studentSearch.trim());
      const res = await api(`/students/batch-balances?${q.toString()}`);
      if (res.ok) {
        setBatchStudents(await parseJson(res));
      } else {
        const err = await parseJson(res);
        toast.error(err?.error || 'Could not load students');
      }
    } finally {
      setLoadingStudents(false);
    }
  }, [activeBatch, studentSearch]);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadBatchStudents();
  }, [loadBatchStudents]);

  useEffect(() => {
    if (!selectedStudent) {
      setHistory([]);
      setInstallments([]);
      setBalance(null);
      return;
    }
    let active = true;
    (async () => {
      const [hRes, iRes] = await Promise.all([
        api(`/payments/student/${selectedStudent}`),
        api(`/installments/student/${selectedStudent}`),
      ]);
      const paid = hRes.ok ? (await parseJson(hRes)) || [] : [];
      if (!active) return;
      if (hRes.ok) setHistory(paid);
      if (iRes.ok) setInstallments(await parseJson(iRes));
      const st = batchStudents.find((s) => String(s.id) === String(selectedStudent));
      if (st) {
        setBalance(Math.max(0, Number(st.balance)));
      } else {
        setBalance(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedStudent, batchStudents]);

  const setBatch = (id) => {
    setActiveBatch(id);
    setForm((f) => ({ ...f, student_id: '' }));
    setSelectedStudent(null);
    setLastReceipt(null);
    if (id) setSearchParams({ batch: id });
    else setSearchParams({});
  };

  const selectStudentForPayment = (id) => {
    setForm((f) => ({ ...f, student_id: String(id) }));
    setSelectedStudent(String(id));
  };

  const collect = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!activeBatch) {
      toast.error('Select a batch first.');
      return;
    }
    if (!form.student_id) {
      toast.error('Select a student.');
      return;
    }
    if (selectedStudentIsDropout) {
      toast.error('Dropped-out students are view-only in payments.');
      return;
    }
    if (Number.isNaN(Number(form.amount_paid)) || Number(form.amount_paid) <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api('/payments', {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(form.student_id),
          amount_paid: Number(form.amount_paid),
          payment_date: form.payment_date,
          notes: form.notes,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) return toast.error(data?.error || 'Failed');
      const paidStudentId = String(form.student_id);
      toast.success(`Recorded — ${data.receipt_no}`);
      setLastReceipt(data);
      setForm((f) => ({ ...f, amount_paid: '', notes: '' }));
      loadPayments();
      loadBatchStudents();
      if (selectedStudent === paidStudentId) {
        const hRes = await api(`/payments/student/${paidStudentId}`);
        if (hRes.ok) setHistory(await parseJson(hRes));
        const iRes = await api(`/installments/student/${paidStudentId}`);
        if (iRes.ok) setInstallments(await parseJson(iRes));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadReceipt = async (paymentId) => {
    try {
      const res = await api(`/payments/${paymentId}/receipt`);
      const r = await parseJson(res);
      if (!res.ok) return toast.error(r?.error || 'Failed');
      await generateReceiptPdf(r);
    } catch {
      toast.error('Receipt download failed. Check template URL/image and try again.');
    }
  };

  const printReceipt = async (paymentId) => {
    const res = await api(`/payments/${paymentId}/receipt`);
    const r = await parseJson(res);
    if (!res.ok) return toast.error(r?.error || 'Failed');
    const w = window.open('', '_blank');
    if (!w) return toast.error('Popup blocked');
    const doc = w.document;
    doc.open();
    doc.write('<!doctype html><html><head><title>Receipt</title></head><body></body></html>');
    doc.close();
    doc.title = `Receipt ${String(r.receipt_no || '')}`;
    doc.body.style.fontFamily = 'Arial,sans-serif';
    doc.body.style.margin = '0';
    doc.body.style.padding = '24px';
    const card = doc.createElement('div');
    card.style.maxWidth = '700px';
    card.style.margin = '0 auto';
    card.style.border = '1px solid #ddd';
    card.style.padding = '20px';
    card.style.background = 'rgba(255,255,255,0.95)';
    const heading = doc.createElement('h2');
    heading.style.margin = '0 0 12px 0';
    heading.textContent = `${String(r.title || 'CLIC Campus')} Receipt`;
    card.appendChild(heading);
    const hr = doc.createElement('hr');
    card.appendChild(hr);
    const addRow = (label, value) => {
      const p = doc.createElement('p');
      const strong = doc.createElement('strong');
      strong.textContent = `${label}: `;
      p.appendChild(strong);
      p.appendChild(doc.createTextNode(String(value ?? '-')));
      card.appendChild(p);
    };
    addRow('Receipt No', r.receipt_no || '-');
    addRow('Date', r.payment_date || '-');
    hr.style.margin = '16px 0';
    card.appendChild(hr.cloneNode());
    
    addRow('Student', r.student_name || '-');
    addRow('Reg No', r.student_reg_no || '-');
    addRow('Course', r.course_name || '-');
    addRow('Batch', r.batch_name || '-');
    card.appendChild(hr.cloneNode());

    if (r.discount_type) {
      let baseFee = Number(r.total_fee);
      if (r.discount_type === 'FIXED') baseFee = baseFee + Number(r.discount_value);
      else if (r.discount_type === 'PERCENTAGE') baseFee = baseFee / (1 - (Number(r.discount_value) / 100));
      
      addRow('Course Fee', formatLKR(baseFee));
      addRow('Discount', r.discount_type === 'FIXED' ? formatLKR(r.discount_value) : `${r.discount_value}%`);
      addRow('Final Payment', formatLKR(r.total_fee));
    } else {
      addRow('Course Fee', formatLKR(r.total_fee || 0));
    }

    card.appendChild(hr.cloneNode());
    addRow('Amount Paid', formatLKR(r.amount_paid || 0));
    addRow('Remaining Balance', formatLKR(r.balance || 0));
    
    card.appendChild(hr.cloneNode());
    addRow('Received by', r.staff_name || '-');
    const footer = doc.createElement('p');
    footer.style.marginTop = '24px';
    footer.style.color = '#555';
    footer.textContent = String(r.receipt_footer || 'Enjoy the best in learning');
    card.appendChild(footer);
    doc.body.appendChild(card);
    w.focus();
    w.print();
  };

  const whatsappForPayment = async (paymentId) => {
    const res = await api(`/payments/${paymentId}/receipt`);
    const r = await parseJson(res);
    if (!res.ok) return toast.error(r?.error || 'Failed');
    const url = buildWhatsAppReceiptUrl(r.student_phone, {
      studentName: `${r.student_name} (Reg No: ${r.student_reg_no || '—'})`,
      amount: r.amount_paid,
      receiptNo: r.receipt_no,
      balance: r.balance,
    });
    if (!url) return toast.error('Add a valid student phone number to send WhatsApp.');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const badgeClass = (a) => {
    if (a === 'overdue') return 'bg-red-100 text-red-800';
    if (a === 'due_today') return 'bg-orange-100 text-orange-800';
    if (a === 'paid') return 'bg-emerald-100 text-emerald-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const studentForForm = form.student_id
    ? batchStudents.find((s) => String(s.id) === String(form.student_id))
    : null;
  const batchMetaForForm = batches.find((b) => String(b.id) === String(activeBatch));
  const selectedStudentIsDropout = studentForForm?.status === 'dropout';

  return (
    <div className="space-y-6 md:space-y-8 px-3 md:px-6 lg:px-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-slate-500">
          Choose a batch to list students with balances, collect fees, and view history — amounts in LKR.
        </p>
      </div>

      {/* Batch + search toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Batch</label>
          <select
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm"
            value={activeBatch}
            onChange={(e) => setBatch(e.target.value)}
          >
            <option value="">— Select batch —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_name} · {b.course_name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search students (live)
          </label>
          <input
            type="search"
            placeholder="Name, phone, or email…"
            disabled={!activeBatch}
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Batch student grid: fee / paid / balance */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Students in selected batch</h2>
        <p className="text-sm text-slate-500">
          Totals update when you change batch or search. Select a student to load installments and payment history.
        </p>
        {!activeBatch && (
          <p className="mt-6 rounded-xl bg-slate-50 py-8 text-center text-slate-500">
            Select a batch to view students and balances.
          </p>
        )}
        {activeBatch && loadingStudents && (
          <p className="mt-6 text-center text-slate-500">Loading students…</p>
        )}
        {activeBatch && !loadingStudents && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Total fee</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-100 ${
                      String(selectedStudent) === String(s.id) ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900">{s.name}</div>
                        {s.status === 'dropout' && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            Dropped out
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">Reg No: {s.reg_no || '—'}</div>
                    </td>
                    <td className="px-3 py-2">{formatLKR(s.total_fee)}</td>
                    <td className="px-3 py-2 text-emerald-700">{formatLKR(s.paid_amount)}</td>
                    <td className="px-3 py-2 font-semibold text-amber-800">{formatLKR(s.balance)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1 text-xs font-semibold text-white ${
                          s.status === 'dropout'
                            ? 'bg-slate-500 hover:bg-slate-600'
                            : 'bg-[#751c58] hover:bg-indigo-700'
                        }`}
                        onClick={() => selectStudentForPayment(s.id)}
                      >
                        {s.status === 'dropout' ? 'View details' : 'Use for payment'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {batchStudents.length === 0 && (
              <p className="py-8 text-center text-slate-400">No students match this batch or search.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <form
          onSubmit={collect}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">Collect payment</h2>
          <p className="text-xs text-slate-500">Student list is limited to the selected batch.</p>
          <div className="mt-4 space-y-3">
            <select
              required
              disabled={!activeBatch}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
              value={form.student_id}
              onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, student_id: v });
                setSelectedStudent(v || null);
              }}
            >
              <option value="">{activeBatch ? 'Select student' : 'Select a batch first'}</option>
              {batchStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Reg No: {s.reg_no || '—'}) · {formatLKR(s.balance)} due
                </option>
              ))}
            </select>

            {form.student_id && !studentForForm && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Student details will appear here once the list finishes loading.
              </p>
            )}
            {studentForForm && (
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#751c58]">
                  Student details
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900">{studentForForm.name}</div>
                <div className="text-xs text-slate-600 mb-2">Reg No: {studentForForm.reg_no || '—'}</div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="font-medium text-slate-800">{studentForForm.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">WhatsApp</dt>
                    <dd className="font-medium text-slate-800">{studentForForm.whatsapp_no || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Address</dt>
                    <dd className="font-medium text-slate-800">{studentForForm.address || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Batch</dt>
                    <dd className="font-medium text-slate-800">
                      {batchMetaForForm?.batch_name || '—'}
                      {batchMetaForForm?.course_name ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {batchMetaForForm.course_name}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-medium capitalize text-slate-800">{studentForForm.status || 'active'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Payment type</dt>
                    <dd className="font-medium text-slate-800">{studentForForm.payment_type || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Total fee</dt>
                    <dd className="font-semibold text-slate-900">{formatLKR(studentForForm.total_fee)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Paid to date</dt>
                    <dd className="font-semibold text-emerald-700">{formatLKR(studentForForm.paid_amount)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Remaining balance</dt>
                    <dd className="text-lg font-bold text-amber-800">{formatLKR(studentForForm.balance)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {selectedStudentIsDropout && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                This student is marked as dropped out. You can still review batch and payment details here, but new
                payments are disabled.
              </p>
            )}

            <input
              required
              type="number"
              step="0.01"
              min="0"
              disabled={selectedStudentIsDropout}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Amount (LKR)"
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
            />
            <input
              type="date"
              disabled={selectedStudentIsDropout}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            />
            <input
              disabled={selectedStudentIsDropout}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button
              type="submit"
              disabled={!activeBatch || !form.student_id || isSubmitting || selectedStudentIsDropout}
              className="w-full rounded-xl bg-[#751c58] py-2.5 text-sm font-semibold text-white hover:bg-[#5a1444] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedStudentIsDropout
                ? 'Payments disabled for dropped-out students'
                : isSubmitting
                  ? 'Recording...'
                  : 'Record payment'}
            </button>
          </div>

          {lastReceipt && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <div className="font-medium text-emerald-900">Last payment</div>
              <div className="mt-1 text-emerald-800">
                {lastReceipt.receipt_no} · {formatLKR(lastReceipt.amount_paid)} · Balance{' '}
                {formatLKR(lastReceipt.balance)}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#751c58]  shadow-sm ring-1 ring-slate-200"
                  onClick={() => downloadReceipt(lastReceipt.id)}
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => printReceipt(lastReceipt.id)}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => whatsappForPayment(lastReceipt.id)}
                >
                  Send via WhatsApp
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Installments & balance</h2>
          <select
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={selectedStudent || ''}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedStudent(v || null);
              setForm((f) => ({ ...f, student_id: v }));
            }}
            disabled={!activeBatch}
          >
            <option value="">{activeBatch ? 'Select student' : 'Select batch first'}</option>
            {batchStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {balance != null && selectedStudent && (
            <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="font-medium text-slate-700">Outstanding balance</div>
              <div className="text-2xl font-bold text-slate-900">{formatLKR(balance)}</div>
            </div>
          )}
          <div className="mt-4 max-h-64 overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2">Due</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Paid</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-2">{i.due_date ? dayjs(i.due_date).format('DD MMM YYYY') : '—'}</td>
                    <td className="py-2">{formatLKR(i.installment_amount)}</td>
                    <td className="py-2">{formatLKR(i.paid_amount)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(i.alert)}`}>
                        {i.alert}
                      </span>
                    </td>
                  </tr>
                ))}
                {!installments.length && selectedStudent && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No installment schedule
                    </td>
                  </tr>
                )}
                {!selectedStudent && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      Select a student
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
          <p className="text-xs text-slate-500">
            {activeBatch
              ? `Filtered to current batch (${batches.find((b) => String(b.id) === String(activeBatch))?.batch_name || ''})`
              : 'Showing all batches — select a batch above to narrow'}
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-2">Receipt</th>
                <th className="py-2 pr-2">Student</th>
                <th className="py-2 pr-2">Batch</th>
                <th className="py-2 pr-2">Amount</th>
                <th className="py-2 pr-2">Date</th>
                <th className="py-2 pr-2">Staff</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2 font-mono text-xs">{p.receipt_no}</td>
                  <td className="py-2 pr-2">
                    <div className="font-medium">{p.student_name}</div>
                    <div className="text-xs text-slate-500 font-normal">Reg No: {p.student_reg_no || '—'}</div>
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-600">{p.batch_name}</td>
                  <td className="py-2 pr-2 font-medium">{formatLKR(p.amount_paid)}</td>
                  <td className="py-2 pr-2">
                    {p.payment_date ? dayjs(p.payment_date).format('DD MMM YYYY') : '—'}
                  </td>
                  <td className="py-2 pr-2">{p.staff_name}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-indigo-600 hover:underline"
                        onClick={() => downloadReceipt(p.id)}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="text-slate-700 hover:underline"
                        onClick={() => printReceipt(p.id)}
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        className="text-emerald-700 hover:underline"
                        onClick={() => whatsappForPayment(p.id)}
                      >
                        WhatsApp
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length && <p className="py-6 text-center text-slate-400">No payments in this view.</p>}
        </div>
      </div>

      {selectedStudent && history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Payment history (selected student)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-2">Receipt</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="py-2">{p.receipt_no}</td>
                    <td className="py-2">{formatLKR(p.amount_paid)}</td>
                    <td className="py-2">{p.payment_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
