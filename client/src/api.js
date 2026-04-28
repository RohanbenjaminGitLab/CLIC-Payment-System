const base = import.meta.env.VITE_API_URL || '';
let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function raw(path, opts = {}) {
  const { _retry, ...rest } = opts;
  const headers = { ...(rest.headers || {}) };
  if (!(rest.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Cold start detection: if request takes > 1.5s, signal the UI
  let wakeTimeout = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('server-wake-needed', { detail: { path } }));
  }, 1500);

  try {
    const res = await fetch(`${base}${path}`, {
      ...rest,
      credentials: 'include',
      headers,
    });

    clearTimeout(wakeTimeout);
    window.dispatchEvent(new CustomEvent('server-ready'));

    if (res.status === 401 && !_retry) {
      const r = await refreshSession();
      if (r.ok) return raw(path, { ...opts, _retry: true });
    }
    return res;
  } catch (err) {
    clearTimeout(wakeTimeout);
    throw err;
  }
}


export async function api(path, opts = {}) {
  return raw(`/api${path}`, opts);
}

export async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
