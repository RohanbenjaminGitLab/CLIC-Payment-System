import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api, parseJson } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatLKR } from '../utils/currency.js';
import { dayjs } from '../dayjs.js';

function IconUsers() {
  return (
    <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function StatCard({ title, value, sub, icon }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs sm:text-sm text-slate-500">{title}</div>
        <div className="truncate text-lg sm:text-xl font-semibold text-slate-900">
          {value}
        </div>
        {sub && <div className="mt-0.5 text-[10px] sm:text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [batchChart, setBatchChart] = useState([]);
  const [batchSummary, setBatchSummary] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [sRes, aRes, bRes] = await Promise.all([
        api('/dashboard/stats'),
        api('/installments/alerts'),
        api('/reports/batch-payment-summary'),
      ]);

      if (!sRes.ok) {
        setErr('Could not load dashboard');
        return;
      }

      setStats(await parseJson(sRes));

      if (aRes.ok) setAlerts(await parseJson(aRes));

      if (bRes.ok) {
        const batches = await parseJson(bRes);
        setBatchSummary(batches || []);
        setBatchChart(
          batches.slice(0, 8).map((b) => ({
            name:
              b.batch_name?.length > 12
                ? `${b.batch_name.slice(0, 10)}…`
                : b.batch_name,
            collected: Number(b.total_collected) || 0,
            pending: Number(b.pending_payments) || 0,
          }))
        );
      }
    })();
  }, []);

  const badge = (x) => {
    if (x === 'overdue') return 'bg-red-100 text-red-800';
    if (x === 'due_today') return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const label = (x) => {
    if (x === 'overdue') return 'Overdue';
    if (x === 'due_today') return 'Due today';
    return 'Upcoming';
  };

  if (!stats && !err) {
    return <div className="text-slate-500 p-4">Loading…</div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-4 lg:px-6">

      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          All amounts in LKR (Rs.)
        </p>
      </div>

      {err && (
        <div className="rounded-xl bg-red-50 p-3 text-red-700 text-sm">
          {err}
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">

        <StatCard title="Total students" value={stats?.totalStudents ?? '—'} icon={<IconUsers />} />
        <StatCard title="Total courses" value={stats?.totalCourses ?? '—'} icon={<IconUsers />} />
        <StatCard title="Total batches" value={stats?.totalBatches ?? '—'} icon={<IconUsers />} />
        <StatCard title="Revenue" value={stats ? formatLKR(stats.revenue) : '—'} icon={<IconMoney />} />
        <StatCard title="Active batches" value={stats?.activeBatches ?? '—'} icon={<IconUsers />} />
        <StatCard title="Completed batches" value={stats?.completedBatches ?? '—'} icon={<IconUsers />} />
        <StatCard title="Full paid students" value={stats?.fullPaidStudents ?? '—'} icon={<IconMoney />} />
        <StatCard title="Installment students" value={stats?.installmentStudents ?? '—'} icon={<IconMoney />} />
        <StatCard title="Overdue" value={stats?.overdueCount ?? '—'} sub="Past due" icon={<IconAlert />} />
        <StatCard title="Due today" value={stats?.dueTodayCount ?? '—'} icon={<IconAlert />} />

      </div>

      {/* CHART + TABLE */}
      <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-2">

        {/* CHART */}
        <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">

          <h2 className="text-base sm:text-lg font-semibold">
            Batch collections vs pending
          </h2>

          <p className="text-xs sm:text-sm text-slate-500">
            Top batches performance
          </p>

          <div className="mt-3 h-56 sm:h-64 lg:h-72">

            {batchChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatLKR(v)} />
                  <Bar dataKey="collected" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                No batch data
              </div>
            )}

          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/batch-payments"
              className="inline-flex items-center justify-center rounded-lg bg-[#751c58] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5a1444]"
            >
              Open batch payments
            </Link>
            <Link
              to="/payments"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open payments
            </Link>
          </div>
        </div>

        {/* TABLE */}
        <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">

          <h2 className="text-base sm:text-lg font-semibold">
            Installment alerts
          </h2>

          <p className="text-xs sm:text-sm text-slate-500">
            Follow up required
          </p>

          <div className="mt-3 max-h-64 sm:max-h-72 overflow-auto">

            <table className="min-w-[480px] w-full text-xs sm:text-sm">

              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Due</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>

              <tbody>

                {alerts.slice(0, 15).map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">

                    <td className="py-2 pr-3">
                      <div className="font-medium text-slate-900">{a.student_name}</div>
                      <div className="text-xs text-slate-500 font-normal">Reg No: {a.student_reg_no || '—'}</div>
                    </td>

                    <td className="py-2 pr-3">
                      {a.due_date ? dayjs(a.due_date).format('DD MMM YYYY') : '—'}
                    </td>

                    <td className="py-2 pr-3">
                      {formatLKR(a.installment_amount)}
                    </td>

                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(a.badge)}`}>
                        {label(a.badge)}
                      </span>
                    </td>

                  </tr>
                ))}

                {!alerts.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No open alerts
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>

      <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Batch payment section
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {user?.role === 'staff'
                ? 'Showing only batches linked to students you enrolled so you can view and manage their payments.'
                : 'Quick access to batch-wise payment tracking and follow-up.'}
            </p>
          </div>
          <Link
            to="/batch-payments"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View all batch payments
          </Link>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {batchSummary.slice(0, 3).map((batch) => (
            <div key={batch.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{batch.batch_name}</div>
                  <div className="text-xs text-slate-500 capitalize">{batch.status}</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>{batch.total_students} students</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Collected</span>
                  <span className="font-semibold text-emerald-700">{formatLKR(batch.total_collected)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Pending</span>
                  <span className="font-semibold text-amber-700">{formatLKR(batch.pending_payments)}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/payments?batch=${batch.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-[#751c58] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5a1444]"
                >
                  Manage payments
                </Link>
                <Link
                  to="/batch-payments"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  Batch summary
                </Link>
              </div>
            </div>
          ))}
        </div>

        {!batchSummary.length && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            No batch payment data available on the dashboard yet.
          </div>
        )}
      </div>
    </div>
  );
}
