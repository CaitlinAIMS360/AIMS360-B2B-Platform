// Small fetch wrapper. Errors carry the server's message and, for cart
// problems, the full preview (errors + warnings).
export async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.errors?.[0] || 'Something went wrong.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const get = (url) => api('GET', url);
export const post = (url, body) => api('POST', url, body || {});
export const put = (url, body) => api('PUT', url, body);
export const patch = (url, body) => api('PATCH', url, body);

export const money = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
