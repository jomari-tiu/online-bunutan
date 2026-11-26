// Talks to the separate backend (the server/ folder).
// Dev: Vite proxies /api to http://localhost:8787 (see vite.config.js).
// Production: set VITE_API_URL to the server's address when building.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('Can’t reach the bunutan server. Check your internet and try again.'), { status: 0 })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status })
  return data
}

export const linkFor = (token) => `${window.location.origin}${window.location.pathname}#/p/${token}`

export function formatDate(d) {
  const date = new Date(d + 'T00:00:00')
  return isNaN(date) ? d : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}
