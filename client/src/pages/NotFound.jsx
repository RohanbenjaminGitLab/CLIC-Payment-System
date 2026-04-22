import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[#751c58]">404 error</div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          The page you requested does not exist or may have been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-xl bg-[#751c58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5d1646]"
          >
            Go to dashboard
          </Link>
          <Link
            to="/login"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}