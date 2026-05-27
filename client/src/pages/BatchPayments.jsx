import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';
import { dayjs } from '../dayjs.js';

const statusBadge = {
  upcoming: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-200 text-slate-700',
};

export function BatchPayments() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api('/reports/batch-payment-summary');
      if (!res.ok) {
        const data = await parseJson(res);
        setErr(data?.error || 'Could not load batch payment summary');
        setLoading(false);
        return;
      }
      setRows(await parseJson(res));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Batch payment dashboard</h1>
        <p className="text-slate-500">
          Students, collected fees, and outstanding balance per batch.
          {user?.role === 'staff'
            ? ' Staff can see only batches tied to students they enrolled.'
            : ' Managers and administrators can review all batches.'}
        </p>
      </div>
      {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {loading && !err && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Loading batch payment summary...</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold text-slate-900">{b.batch_name}</div>
                <div className="text-sm text-slate-500">{b.course_name}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[b.status] || ''}`}
              >
                {b.status}
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Students</dt>
                <dd className="font-semibold text-slate-900">{b.total_students}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Collected</dt>
                <dd className="font-semibold text-emerald-700">{formatLKR(b.total_collected)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Pending</dt>
                <dd className="font-semibold text-amber-700">{formatLKR(b.pending_payments)}</dd>
              </div>
              <div className="text-xs text-slate-400">
                {b.start_date && b.end_date
                  ? `${dayjs(b.start_date).format('DD MMM YYYY')} – ${dayjs(b.end_date).format('DD MMM YYYY')}`
                  : ''}
              </div>
            </dl>
            <Link
              to={`/payments?batch=${b.id}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#751c58]  py-2 text-sm font-semibold text-white hover:bg-[#5a1444]"
            >
              {user?.role === 'staff' ? 'View your batch payments' : 'View payments in this batch'}
            </Link>
          </div>
        ))}
      </div>
      {!rows.length && !err && !loading && (
        <p className="text-center text-slate-400">No batch data yet.</p>
      )}
    </div>
  );
}
