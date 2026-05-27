import { useEffect, useState } from 'react';
import { api, parseJson } from '../api';
import { dayjs } from '../dayjs.js';

export function Audit() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await api('/reports/audit?limit=300');
      if (res.ok) setRows(await parseJson(res));
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit logs</h1>
        <p className="text-slate-500">Security and compliance trail</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.created_at ? dayjs(r.created_at).format('DD MMM YYYY HH:mm') : '—'}
                </td>
                <td className="px-4 py-3">{r.user_name || r.user_email || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-3">
                  {r.entity_type} {r.entity_id}
                </td>
                <td className="px-4 py-3 text-xs">{r.ip_address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
