import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import ChatPanel from './components/ChatPanel.jsx'
import Canvas from './components/Canvas.jsx'
import ModuleChips from './components/ModuleChips.jsx'

export default function App() {
  const [health, setHealth] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [artifacts, setArtifacts] = useState([])
  const [jobs, setJobs] = useState([])
  const [busy, setBusy] = useState(false)
  const [template, setTemplate] = useState('')
  const uploadRef = useRef(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }))
  }, [])

  const pushMessage = (role, text) =>
    setMessages((prev) => [...prev, { role, text, at: Date.now() + Math.random() }])

  const absorbResult = (result) => {
    if (result.session_id) setSessionId(result.session_id)
    if (result.artifacts?.length) setArtifacts((prev) => [...result.artifacts, ...prev])
    if (result.jobs?.length) setJobs((prev) => [...result.jobs, ...prev])
  }

  const sendChat = async (text) => {
    if (!text.trim() || busy) return
    pushMessage('user', text)
    setBusy(true)
    try {
      const result = await api.chat(text, sessionId)
      absorbResult(result)
      pushMessage('assistant', result.reply_he)
    } catch (e) {
      pushMessage('error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const sendDrawing = async (file, note) => {
    if (busy) return
    pushMessage('user', `📎 העלאת שרטוט: ${file.name}${note ? ` — ${note}` : ''}`)
    setBusy(true)
    try {
      const result = await api.drawing(file, note, sessionId)
      absorbResult(result)
      if (result.jobs === undefined && result.status)
        setJobs((prev) => [{ module: 'M-05', status: result.status, summary: '' }, ...prev])
      pushMessage(result.status === 'ok' ? 'assistant' : 'error', result.summary_he)
    } catch (e) {
      pushMessage('error', e.message)
    } finally {
      setBusy(false)
    }
  }

  const aiOff = health && !health.ai_enabled

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-line bg-panel px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display font-black text-2xl">
            <span className="text-accent">Mech</span>Mind
          </h1>
          <span className="text-sm text-slate-400 font-display">מהנדס-העל · עומק מכני לפי דרישה</span>
        </div>
        <div className="mr-auto flex items-center gap-3 text-xs">
          {health?.status === 'ok' ? (
            <span className="flex items-center gap-1.5 text-ok">
              <span className="w-2 h-2 rounded-full bg-ok inline-block" /> שרת פעיל
            </span>
          ) : health?.status === 'down' ? (
            <span className="flex items-center gap-1.5 text-danger">
              <span className="w-2 h-2 rounded-full bg-danger inline-block" /> השרת לא זמין
            </span>
          ) : null}
          {aiOff && (
            <span className="text-accent border border-accent/50 rounded-full px-2 py-0.5">
              AI כבוי — חסר ANTHROPIC_API_KEY
            </span>
          )}
        </div>
      </header>

      <ModuleChips
        onTemplate={(t) => setTemplate(t)}
        onUpload={() => uploadRef.current?.()}
      />

      <main className="flex-1 flex min-h-0">
        <section className="w-[46%] min-w-[380px] border-l border-line flex flex-col">
          <ChatPanel
            messages={messages}
            busy={busy}
            template={template}
            onTemplateConsumed={() => setTemplate('')}
            onSend={sendChat}
            onDrawing={sendDrawing}
            registerUploadTrigger={(fn) => { uploadRef.current = fn }}
          />
        </section>
        <section className="flex-1 min-w-0">
          <Canvas artifacts={artifacts} jobs={jobs} />
        </section>
      </main>
    </div>
  )
}
