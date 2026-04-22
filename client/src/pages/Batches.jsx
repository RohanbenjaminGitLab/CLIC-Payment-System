import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { dayjs } from '../dayjs.js';

const statusStyle = {
  upcoming: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-200 text-slate-700',
};

export function Batches() {
  const { isAdmin, isManager } = useAuth();
  const canManageBatches = isAdmin || isManager;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timingFilter, setTimingFilter] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    timing: 'MORNING',
    schedule: 'WEEKDAY',
    start_date: '',
    end_date: '',
    status: 'upcoming',
  });
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    if (statusFilter) q.set('status', statusFilter);
    if (timingFilter) q.set('timing', timingFilter);
    if (scheduleFilter) q.set('schedule', scheduleFilter);
    const res = await api(`/batches?${q.toString()}`);
    if (res.ok) setRows(await parseJson(res));
  }, [search, statusFilter, timingFilter, scheduleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.start_date || !form.end_date) {
      return toast.error('Please fill all required fields');
    }
    const body = {
      ...form,
    };
    if (modal === 'create') {
      const res = await api('/batches', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) return alert((await parseJson(res))?.error || 'Failed');
    } else {
      const res = await api(`/batches/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      if (!res.ok) return alert((await parseJson(res))?.error || 'Failed');
    }
    setModal(null);
    load();
  };

  const confirmRemove = async () => {
    if (!deleteId) return;
    const res = await api(`/batches/${deleteId}`, { method: 'DELETE' });
    const data = await parseJson(res);
    setDeleteId(null);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success('Batch deleted');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batches</h1>
          <p className="text-slate-500">Cohorts linked to courses</p>
        </div>
        {canManageBatches && (
          <button
            type="button"
            onClick={() => {
              setForm({
                timing: 'MORNING',
                schedule: 'WEEKDAY',
                start_date: '',
                end_date: '',
                status: 'upcoming',
              });
              setModal('create');
            }}
            className="rounded-lg bg-[#751c58] px-4 py-2 text-sm font-semibold text-white"
          >
            Add batch
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search batches or course"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All status</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={timingFilter}
            onChange={(e) => setTimingFilter(e.target.value)}
          >
            <option value="">All timings</option>
            <option value="MORNING">Morning</option>
            <option value="EVENING">Evening</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
          >
            <option value="">All schedules</option>
            <option value="WEEKDAY">Weekday</option>
            <option value="WEEKEND">Weekend</option>
          </select>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Schedule</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Status</th>
              {canManageBatches && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{b.batch_name}</td>
                <td className="px-4 py-3 capitalize">{String(b.timing).toLowerCase()} / {String(b.schedule).toLowerCase()}</td>
                <td className="px-4 py-3">{b.start_date ? dayjs(b.start_date).format('DD MMM YYYY') : '—'}</td>
                <td className="px-4 py-3">{b.end_date ? dayjs(b.end_date).format('DD MMM YYYY') : '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[b.status] || ''}`}
                  >
                    {b.status}
                  </span>
                </td>
                {canManageBatches && (
                  <td className="space-x-2 px-4 py-3">
                    <button
                      type="button"
                      className="text-[#751c58]"
                      onClick={() => {
                        setForm({
                          id: b.id,
                          timing: b.timing || 'MORNING',
                          schedule: b.schedule || 'WEEKDAY',
                          start_date: b.start_date?.slice(0, 10),
                          end_date: b.end_date?.slice(0, 10),
                          status: b.status,
                        });
                        setModal('edit');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                      onClick={() => setDeleteId(b.id)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{modal === 'create' ? 'Add batch' : 'Edit batch'}</h2>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={form.timing}
                  onChange={(e) => setForm({ ...form, timing: e.target.value })}
                >
                  <option value="MORNING">Morning Batch</option>
                  <option value="EVENING">Evening Batch</option>
                </select>
                <select
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={form.schedule}
                  onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                >
                  <option value="WEEKDAY">Weekday Batch</option>
                  <option value="WEEKEND">Weekend Batch</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <input
                  type="date"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="rounded-lg bg-[#751c58] px-4 py-2 text-sm text-white" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete batch?"
        message="Are you sure you want to delete this record? This action cannot be undone."
        onConfirm={confirmRemove}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
