export function ServerError({ onRetry }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-600">500 error</div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          An unexpected error occurred while loading the application. Please try again and verify your deployed API URL if the issue continues.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-xl bg-[#751c58] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5d1646]"
        >
          Reload application
        </button>
      </div>
    </div>
  );
}