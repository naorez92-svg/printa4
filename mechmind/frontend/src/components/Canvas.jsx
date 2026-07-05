import { api } from '../api.js'
import SafetyBanner from './SafetyBanner.jsx'

const KIND_META = {
  step: { icon: '🧊', label: 'מודל STEP' },
  dxf: { icon: '📏', label: 'שרטוט DXF' },
  svg: { icon: '🖼️', label: 'תצוגה מקדימה' },
  pdf: { icon: '📄', label: 'מסמך PDF' },
  xlsx: { icon: '📊', label: 'כתב כמויות' },
  json: { icon: '🧾', label: 'נתונים JSON' },
}

const STATUS_META = {
  ok: { color: 'text-ok', label: 'הושלם' },
  needs_engineer: { color: 'text-danger', label: 'דורש מהנדס 🔴' },
  error: { color: 'text-danger', label: 'שגיאה' },
}

export default function Canvas({ artifacts, jobs }) {
  const hasStrength = jobs.some((j) => j.module === 'M-02')
  const previews = artifacts.filter((a) => a.kind === 'svg')
  const files = artifacts.filter((a) => a.kind !== 'svg')

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <h2 className="font-display font-bold text-lg text-slate-300">קנבס תוצרים</h2>

      {hasStrength && <SafetyBanner />}

      {artifacts.length === 0 && jobs.length === 0 && (
        <div className="border border-dashed border-line rounded-xl p-10 text-center text-slate-500 text-sm">
          כאן יופיעו התוצרים: מודלים, שרטוטים, כתבי כמויות ותוכניות פרויקט —
          מוכנים להורדה.
        </div>
      )}

      {previews.map((a) => (
        <div key={a.id} className="bg-white rounded-xl overflow-hidden border border-line">
          <img
            src={api.downloadUrl(a)}
            alt="תצוגה מקדימה של המודל"
            className="w-full max-h-72 object-contain p-3"
          />
          <div className="bg-panel px-3 py-1.5 text-xs text-slate-400 flex justify-between">
            <span>תצוגה מקדימה · {a.module}</span>
            <a href={api.downloadUrl(a)} download className="text-spark hover:underline">הורדה</a>
          </div>
        </div>
      ))}

      {files.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {files.map((a) => {
            const meta = KIND_META[a.kind] || { icon: '📦', label: a.kind }
            return (
              <a
                key={a.id}
                href={api.downloadUrl(a)}
                download
                className="bg-panel border border-line rounded-xl p-4 hover:border-accent
                           transition-colors group"
              >
                <div className="text-2xl mb-1.5">{meta.icon}</div>
                <div className="font-medium text-sm group-hover:text-accent">{meta.label}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5" dir="ltr">{a.filename}</div>
                <div className="text-[10px] text-slate-600 mt-1.5">{a.module} · לחץ להורדה ⬇</div>
              </a>
            )
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium text-slate-400 mt-2">יומן הרצות</h3>
          {jobs.slice(0, 8).map((j, i) => {
            const s = STATUS_META[j.status] || STATUS_META.error
            return (
              <div key={i} className="flex items-center gap-2 text-xs bg-panel/60 border border-line rounded-lg px-3 py-1.5">
                <span className="font-mono text-slate-500">{j.module}</span>
                <span className={s.color}>{s.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
