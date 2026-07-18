const BASE = import.meta.env.VITE_API_URL || ''

async function handle(res) {
  if (!res.ok) {
    let detail = `שגיאת שרת (${res.status})`
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : detail
    } catch { /* גוף לא-JSON */ }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  health: () => fetch(`${BASE}/health`).then(handle),
  chat: (message, session) =>
    fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: session?.id ?? null,
        session_token: session?.token ?? null,
      }),
    }).then(handle),
  drawing: (file, note, session) => {
    const form = new FormData()
    form.append('file', file)
    form.append('note', note || '')
    if (session?.id) form.append('session_id', session.id)
    if (session?.token) form.append('session_token', session.token)
    return fetch(`${BASE}/api/drawing`, { method: 'POST', body: form }).then(handle)
  },
  downloadUrl: (artifact) => `${BASE}${artifact.download_url}`,
}
