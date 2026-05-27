import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, parseJson } from '../api';

export function Settings() {
  const [cfg, setCfg] = useState(null);
  const [credForm, setCredForm] = useState({
    new_name: '',
    new_email: '',
    new_password: '',
    current_password: '',
  });
  const [requests, setRequests] = useState([]);

  const load = useCallback(async () => {
    const res = await api('/settings');
    if (res.ok) {
      const data = await parseJson(res);
      setCfg(data);
    }
    const rr = await api('/auth/change-requests');
    if (rr.ok) setRequests((await parseJson(rr)) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitCredentialRequest = async () => {
    if (!credForm.current_password) return toast.error('Current password is required');
    const res = await api('/auth/change-request', {
      method: 'POST',
      body: JSON.stringify(credForm),
    });
    const data = await parseJson(res);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success(data?.message || 'Updated');
    setCredForm({ new_name: '', new_email: '', new_password: '', current_password: '' });
  };

  const reviewRequest = async (id, action) => {
    const res = await api(`/auth/change-requests/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(action === 'reject' ? { reason: 'Rejected by admin' } : {}),
    });
    const data = await parseJson(res);
    if (!res.ok) return toast.error(data?.error || 'Failed');
    toast.success(`Request ${action}d`);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Account security configuration</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">
          {cfg?.role === 'admin' ? 'Change credentials (direct apply)' : 'Change credentials (admin approval for email/password)'}
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="New display name (optional)"
            value={credForm.new_name}
            onChange={(e) => setCredForm((f) => ({ ...f, new_name: e.target.value }))}
          />
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="New email (optional)" value={credForm.new_email} onChange={(e) => setCredForm((f) => ({ ...f, new_email: e.target.value }))} />
          <input className="rounded-lg border px-3 py-2 text-sm" type="password" placeholder="New password (optional)" value={credForm.new_password} onChange={(e) => setCredForm((f) => ({ ...f, new_password: e.target.value }))} />
          <input className="rounded-lg border px-3 py-2 text-sm" type="password" placeholder="Current password (required)" value={credForm.current_password} onChange={(e) => setCredForm((f) => ({ ...f, current_password: e.target.value }))} />
        </div>
        <button type="button" onClick={submitCredentialRequest} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Submit credential change
        </button>
      </div>

      {cfg?.role === 'admin' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Credential change approvals</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Requested name</th>
                    <th className="px-3 py-2">Requested email</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.user_name}</td>
                      <td className="px-3 py-2">{r.new_name || '—'}</td>
                      <td className="px-3 py-2">{r.new_email || 'Password only'}</td>
                      <td className="px-3 py-2 capitalize">{r.status}</td>
                      <td className="px-3 py-2 space-x-2">
                        {r.status === 'pending' && (
                          <>
                            <button type="button" className="text-emerald-700" onClick={() => reviewRequest(r.id, 'approve')}>Approve</button>
                            <button type="button" className="text-red-700" onClick={() => reviewRequest(r.id, 'reject')}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
