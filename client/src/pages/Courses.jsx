import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { api, parseJson } from '../api';
import { formatLKR } from '../utils/currency.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

const emptyForm = { course_name: '', description: '', duration: '', fee: '', category: '' };

export function Courses() {
  const { isAdmin, isManager } = useAuth();
  const canManageCourses = isAdmin || isManager;
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('table');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [category, setCategory] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    if (category) q.set('category', category);

    const res = await api(`/courses?${q.toString()}`);
    if (res.ok) setRows(await parseJson(res));
  }, [search, category]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (c) => {
    setForm({
      course_name: c.course_name,
      description: c.description || '',
      duration: c.duration || '',
      fee: c.fee,
      category: c.category || '',
      id: c.id,
    });
    setModal('edit');
  };

  const save = async () => {
    const body = {
      course_name: form.course_name,
      description: form.description,
      duration: form.duration,
      fee: Number(form.fee),
      category: form.category,
    };

    const res =
      modal === 'create'
        ? await api('/courses', { method: 'POST', body: JSON.stringify(body) })
        : await api(`/courses/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });

    if (!res.ok) {
      toast.error((await parseJson(res))?.error || 'Failed');
      return;
    }

    setModal(null);
    load();
    toast.success('Saved successfully');
  };

  const confirmRemove = async () => {
    if (!deleteId) return;

    const res = await api(`/courses/${deleteId}`, { method: 'DELETE' });
    const data = await parseJson(res);

    setDeleteId(null);

    if (!res.ok) return toast.error(data?.error || 'Failed');

    toast.success('Course deleted');
    load();
  };

  return (
    <div className="space-y-4 px-3 sm:px-4 lg:px-6">

      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Courses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage programs and fees
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">

          <input
            placeholder="Search…"
            className="w-full sm:w-40 rounded-lg border px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <input
            placeholder="Category"
            className="w-full sm:w-40 rounded-lg border px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          {/* VIEW SWITCH */}
          <div className="flex rounded-lg border p-0.5 w-full sm:w-auto">
            <button
              className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md ${
                view === 'table' ? 'bg-[#751c58] text-white' : ''
              }`}
              onClick={() => setView('table')}
            >
              Table
            </button>

            <button
              className={`flex-1 sm:flex-none px-3 py-1 text-sm rounded-md ${
                view === 'cards' ? 'bg-[#751c58] text-white' : ''
              }`}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
          </div>

          {canManageCourses && (
            <button
              onClick={openCreate}
              className="w-full sm:w-auto rounded-lg bg-[#751c58] px-4 py-2 text-sm text-white hover:bg-[#5a1444]"
            >
              Add course
            </button>
          )}
        </div>
      </div>

      {/* TABLE VIEW */}
      {view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">

          <table className="min-w-[600px] w-full text-sm">

            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Fee</th>
                {canManageCourses && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t">

                  <td className="px-4 py-3 font-medium">
                    {c.course_name}
                  </td>

                  <td className="px-4 py-3">
                    {c.category || '—'}
                  </td>

                  <td className="px-4 py-3">
                    {c.duration || '—'}
                  </td>

                  <td className="px-4 py-3">
                    {formatLKR(c.fee)}
                  </td>

                  {canManageCourses && (
                    <td className="px-4 py-3 flex gap-2">
                      <button className="text-[#751c58]" onClick={() => openEdit(c)}>
                        Edit
                      </button>
                      <button className="text-red-600" onClick={() => setDeleteId(c.id)}>
                        Delete
                      </button>
                    </td>
                  )}

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      ) : (

        /* CARD VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {rows.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="text-lg font-semibold">
                {c.course_name}
              </div>

              <div className="text-xs text-slate-400 uppercase">
                {c.category || '—'}
              </div>

              <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                {c.description}
              </p>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">{c.duration}</span>
                <span className="font-semibold">
                  {formatLKR(c.fee)}
                </span>
              </div>

              {canManageCourses && (
                <div className="mt-3 flex gap-3">
                  <button className="text-[#751c58]" onClick={() => openEdit(c)}>
                    Edit
                  </button>
                  <button className="text-red-600" onClick={() => setDeleteId(c.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}

        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg rounded-xl bg-white p-5 sm:p-6">

            <h2 className="text-lg font-semibold">
              {modal === 'create' ? 'Add course' : 'Edit course'}
            </h2>

            <div className="mt-4 space-y-3">

              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Course name"
                value={form.course_name}
                onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              />

              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder="Duration"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />

                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  type="number"
                  placeholder="Fee"
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
                />

              </div>

              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />

            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="border px-4 py-2 rounded-lg text-sm"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>

              <button
                className="bg-[#751c58] text-white px-4 py-2 rounded-lg text-sm"
                onClick={save}
              >
                Save
              </button>
            </div>

          </div>

        </div>
      )}

      {/* DELETE */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete course?"
        message="This action cannot be undone."
        onConfirm={confirmRemove}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}