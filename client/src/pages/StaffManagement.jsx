import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

const strongHint =
  'Min 8 chars with uppercase, lowercase, number, and special character.';
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export function StaffManagement() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [perf, setPerf] = useState({});
  const [modal, setModal] = useState(null);
  const [statsModal, setStatsModal] = useState(null);
  const [stats, setStats] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    is_active: true,
    base_salary: 0,
  });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    commission_rate: 5,
    base_salary: 0,
  });
  const [userDeleteId, setUserDeleteId] = useState(null);
  const [commissionPerStudent, setCommissionPerStudent] = useState('750');
  const commissionPerStudentNum = Number(commissionPerStudent || 0);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    if (roleFilter) q.set('role', roleFilter);
    const res = await api(`/users?${q.toString()}`);
    if (res.ok) setRows(await parseJson(res));
    if (isAdmin) {
      const cfg = await api('/settings');
      if (cfg.ok) {
        const data = await parseJson(cfg);
        setCommissionPerStudent(String(data?.commissionPerStudent ?? 750));
      }
    }
    if (isAdmin) {
      const pr = await api('/reports/staff-performance');
      if (pr.ok) {
        const list = await parseJson(pr);
        const map = {};
        list.forEach((r) => {
          map[r.id] = r;
        });
        setPerf(map);
      }
    } else {
      setPerf({});
    }
  }, [search, roleFilter, isAdmin]);

  const saveCommissionPerStudent = async () => {
    const v = Number(commissionPerStudent);
    if (Number.isNaN(v) || v < 0) return toast.error('Enter valid commission amount in LKR');
    const res = await api('/settings/commission-per-student', {
      method: 'PATCH',
      body: JSON.stringify({ commission_per_student: v }),
    });
    const data = await parseJson(res);
    if (!res.ok) {
      if (res.status === 404) return toast.error('Commission API not found. Restart server and try again.');
      return toast.error(data?.error || `Failed (${res.status})`);
    }
    toast.success('Commission per student updated');
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const openStats = async (id) => {
    setStatsModal(id);
    setStats(null);
    const res = await api(`/users/${id}/stats`);
    if (!res.ok) {
      toast.error((await parseJson(res))?.error || 'Failed to load stats');
      return;
    }
    setStats(await parseJson(res));
  };

  const save = async () => {
    if (!form.name.trim() || !emailOk(form.email) || !form.password) {
      return toast.error('Enter valid name, email, and password');
    }
    const payload = isAdmin
      ? form
      : {
          name: form.name,
          email: form.email,
          password: form.password,
          role: 'staff',
        };
    const res = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await parseJson(res);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success('User created');
    setModal(false);
    setForm({ name: '', email: '', password: '', role: 'staff', commission_rate: 5, base_salary: 0 });
    load();
  };

  const confirmRemoveUser = async () => {
    if (!userDeleteId) return;
    const res = await api(`/users/${userDeleteId}`, { method: 'DELETE' });
    const data = await parseJson(res);
    setUserDeleteId(null);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success('User removed');
    load();
  };

  const saveEdit = async () => {
    const id = editModal;
    if (!editForm.name.trim() || !emailOk(editForm.email)) {
      return toast.error('Enter a valid name and email');
    }
    const body = {
      name: editForm.name,
      email: editForm.email,
      is_active: editForm.is_active,
    };
    if (isAdmin) body.base_salary = Number(editForm.base_salary || 0);
    if (editForm.password) body.password = editForm.password;
    if (isAdmin) body.role = editForm.role;
    const res = await api(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await parseJson(res);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success(data?.message || 'Saved');
    setEditModal(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff management</h1>
          <p className="text-slate-500">
            Add and manage team accounts. Staff cannot delete records and only see their own students and payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="rounded-xl bg-[#751c58] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5a1444]"
        >
          Add staff / user
        </button>
      </div>
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Commission setup (Per student enrollment)</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-56"
              value={commissionPerStudent}
              onChange={(e) => setCommissionPerStudent(e.target.value)}
            />
            <span className="text-xs text-slate-500">LKR paid per student enrolled</span>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              onClick={saveCommissionPerStudent}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search staff/user"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            {isAdmin && <option value="admin">Admin</option>}
          </select>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              {isAdmin && <th className="px-4 py-3">Students</th>}
              {isAdmin && <th className="px-4 py-3">Payments</th>}
              {isAdmin && <th className="px-4 py-3">Collected</th>}
              {isAdmin && <th className="px-4 py-3">Commission</th>}
              {isAdmin && <th className="px-4 py-3">Per student</th>}
              {isAdmin && <th className="px-4 py-3">Base salary</th>}
              {isAdmin && <th className="px-4 py-3">Final salary</th>}
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                {isAdmin && <td className="px-4 py-3">{perf[u.id]?.students_handled ?? '—'}</td>}
                {isAdmin && <td className="px-4 py-3">{perf[u.id]?.payment_count ?? '—'}</td>}
                {isAdmin && <td className="px-4 py-3">{perf[u.id] ? formatLKR(perf[u.id].total_collected) : '—'}</td>}
                {isAdmin && (
                  <td className="px-4 py-3">
                    {formatLKR(Number(perf[u.id]?.students_handled || 0) * Number(perf[u.id]?.commission_per_student ?? commissionPerStudentNum))}
                  </td>
                )}
                {isAdmin && <td className="px-4 py-3">{formatLKR(perf[u.id]?.commission_per_student || 0)}</td>}
                {isAdmin && <td className="px-4 py-3">{formatLKR(u.base_salary || 0)}</td>}
                {isAdmin && (
                  <td className="px-4 py-3 font-semibold">
                    {formatLKR(
                      Number(u.base_salary || 0) +
                        Number(perf[u.id]?.students_handled || 0) *
                          Number(perf[u.id]?.commission_per_student ?? commissionPerStudentNum)
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {u.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="space-x-2 px-4 py-3 whitespace-nowrap">
                  {(u.role === 'staff' || u.role === 'manager') && (
                    <button type="button" className="text-indigo-600 hover:underline" onClick={() => openStats(u.id)}>
                      View stats
                    </button>
                  )}
                  {(isAdmin || (user?.role === 'manager' && u.role === 'staff')) && (
                    <button
                      type="button"
                      className="text-slate-700 hover:underline"
                      onClick={() => {
                        setEditModal(u.id);
                        setEditForm({
                          name: u.name,
                          email: u.email,
                          password: '',
                          role: u.role,
                          is_active: !!u.is_active,
                          base_salary: u.base_salary ?? 0,
                        });
                      }}
                    >
                      Edit
                    </button>
                  )}
                  {isAdmin && u.id !== user?.id && (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                      onClick={() => setUserDeleteId(u.id)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Create user</h2>
            <p className="text-xs text-slate-500">{strongHint}</p>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {isAdmin && (
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {isAdmin && (
                <>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Commission rate %"
                    value={form.commission_rate}
                    onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Base salary"
                    value={form.base_salary}
                    onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                  />
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" onClick={save}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {statsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Performance</h2>
            {!stats && <p className="mt-4 text-slate-500">Loading…</p>}
            {stats && (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-medium">{stats.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Students enrolled</dt>
                  <dd>{stats.students_handled}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Payment transactions</dt>
                  <dd>{stats.payments_collected_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total collected</dt>
                  <dd className="font-semibold text-emerald-700">{formatLKR(stats.total_collected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Commission earned</dt>
                  <dd className="font-semibold text-indigo-700">
                    {formatLKR(
                      Number(stats.students_handled || 0) *
                        Number(stats.commission_per_student ?? commissionPerStudentNum)
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Commission per student</dt>
                  <dd>{formatLKR(stats.commission_per_student || 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Base salary</dt>
                  <dd>{formatLKR(stats.base_salary || 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Final salary</dt>
                  <dd className="font-bold text-slate-900">
                    {formatLKR(
                      Number(stats.base_salary || 0) +
                        Number(stats.students_handled || 0) *
                          Number(stats.commission_per_student ?? commissionPerStudentNum)
                    )}
                  </dd>
                </div>
              </dl>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => setStatsModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Edit user</h2>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                type="password"
                placeholder="New password (optional)"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
              {isAdmin && (
                <select
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {isAdmin && (
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Base salary"
                  value={editForm.base_salary}
                  onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value })}
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setEditModal(null)}>
                Cancel
              </button>
              <button type="button" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white" onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!userDeleteId}
        title="Remove user?"
        message="Are you sure you want to delete this record? This action cannot be undone."
        onConfirm={confirmRemoveUser}
        onCancel={() => setUserDeleteId(null)}
      />
    </div>
  );
}
