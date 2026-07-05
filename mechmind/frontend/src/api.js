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
  chat: (message, sessionId) =>
    fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    }).then(handle),
  drawing: (file, note, sessionId) => {
    const form = new FormData()
    form.append('file', file)
    form.append('note', note || '')
    if (sessionId) form.append('session_id', sessionId)
    return fetch(`${BASE}/api/drawing`, { method: 'POST', body: form }).then(handle)
  },
  downloadUrl: (artifact) => `${BASE}${artifact.download_url}`,
}
