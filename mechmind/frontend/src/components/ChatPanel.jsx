import { useEffect, useRef, useState } from 'react'

export default function ChatPanel({
  messages, busy, template, onTemplateConsumed, onSend, onDrawing, registerUploadTrigger,
}) {
  const [input, setInput] = useState('')
  const fileRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (template) {
      setInput(template)
      onTemplateConsumed()
    }
  }, [template, onTemplateConsumed])

  useEffect(() => {
    registerUploadTrigger(() => fileRef.current?.click())
  }, [registerUploadTrigger])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const submit = () => {
    if (!input.trim() || busy) return
    onSend(input)
    setInput('')
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onDrawing(file, input.trim())
    e.target.value = ''
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-16 space-y-2">
            <div className="text-4xl">⚙️</div>
            <p className="font-display text-lg text-slate-400">מה נבנה היום?</p>
            <p className="text-sm max-w-sm mx-auto leading-relaxed">
              תאר רכיב, שאל שאלת חוזק, בקש המלצת חומר או תהליך ייצור —
              או העלה תמונת שרטוט דרך הצ'יפ "קורא שרטוטים".
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.at}
            className={
              m.role === 'user'
                ? 'bg-spark/10 border border-spark/30 rounded-xl rounded-tr-sm px-4 py-2.5 mr-8'
                : m.role === 'error'
                  ? 'bg-danger/10 border border-danger/40 rounded-xl px-4 py-2.5 ml-8 text-danger'
                  : 'bg-panel border border-line rounded-xl rounded-tl-sm px-4 py-2.5 ml-8'
            }
          >
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
          </div>
        ))}
        {busy && (
          <div className="bg-panel border border-line rounded-xl px-4 py-3 ml-8 flex items-center gap-2 text-slate-400 text-sm">
            <span className="animate-spin inline-block">⚙️</span>
            מהנדס-העל עובד — מריץ כלים דטרמיניסטיים…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3 bg-panel/60 shrink-0">
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="העלאת שרטוט (תמונה או PDF)"
            className="h-10 w-10 shrink-0 rounded-lg border border-line hover:border-accent
                       hover:text-accent transition-colors disabled:opacity-40"
          >
            📎
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder="תאר רכיב, שאל על חוזק, חומר או ייצור… (Enter לשליחה)"
            className="flex-1 resize-none rounded-lg bg-steel border border-line px-3 py-2 text-sm
                       focus:outline-none focus:border-spark placeholder:text-slate-500"
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            className="h-10 px-5 shrink-0 rounded-lg bg-accent text-steel font-bold text-sm
                       hover:brightness-110 transition disabled:opacity-40"
          >
            שלח
          </button>
        </div>
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={onFile} />
      </div>
    </div>
  )
}
