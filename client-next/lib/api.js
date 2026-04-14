/**
 * Thin fetch wrapper that auto-attaches JWT token from localStorage.
 */

const API_BASE = '';

function getToken() {
  if (typeof window === 'undefined') return null;

  // Determine the expected role from the current URL path
  const path = window.location.pathname;
  let expectedRole;
  if (path.startsWith('/admin')) {
    expectedRole = 'admin';
  } else if (path.startsWith('/faculty')) {
    expectedRole = 'faculty';
  } else {
    expectedRole = 'student';
  }

  // Prefer role-scoped token for the current page
  const roleToken = localStorage.getItem(`${expectedRole}_token`);
  if (roleToken) return roleToken;

  // Legacy fallback
  return localStorage.getItem('token');
}
// test
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // Always fetch fresh — never serve stale cached responses
    cache: 'no-store',
  });

  if (res.status === 401) {
    // Token expired or invalid — clear all stored tokens and redirect to login
    if (typeof window !== 'undefined') {
      ['student', 'admin', 'faculty'].forEach(role => {
        localStorage.removeItem(`${role}_token`);
        localStorage.removeItem(`${role}_user`);
      });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    throw new Error('Unauthorized');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
