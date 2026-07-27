import { useMemo, useRef, useState } from "react";
import { MODULES } from "../data/modules.js";
import { TOFES4_CHECKLIST } from "../data/tofes4.js";
import { normalize } from "../lib/text.js";

// חיפוש גלובלי מהבית: מודולים, טופס 4 וספריית התקנים — הופך את האפליקציה
// מכלי לימוד לכלי עזר בשטח ("איפה היה הקטע על ממ"ד?"). הכול מקומי, בלי רשת.

// אינדקס המודולים נבנה פעם אחת: לכל מודול רשימת שדות ניתנים לחיפוש
const MODULE_INDEX = MODULES.map((m) => ({
  id: m.id,
  icon: m.icon,
  title: m.title,
  fields: [m.title, m.summary, ...m.points, ...(m.pitfalls || []), ...(m.standards || [])].map(
    (text) => ({ text, norm: normalize(text) })
  ),
}));

const TOFES4_INDEX = TOFES4_CHECKLIST.map((item) => ({
  id: item.id,
  icon: item.icon,
  text: `${item.authority} — ${item.what}`,
  norm: normalize(`${item.authority} ${item.what} ${item.requires}`),
}));

function snippet(text, maxLen = 90) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export default function SearchBox({ onOpenModule, onGoStandards, onGoTab }) {
  const [query, setQuery] = useState("");
  // ספריית התקנים נטענת עצל (chunk נפרד) — מושכים אותה ברקע כשמתחילים לחפש
  const standardsRef = useRef(null);
  const [standardsReady, setStandardsReady] = useState(false);
  const loadStandards = () => {
    if (standardsRef.current) return;
    standardsRef.current = import("../data/standards.js")
      .then((mod) => {
        standardsRef.current = mod;
        setStandardsReady(true);
      })
      .catch(() => {
        // רשת נפלה באמצע — משחררים את הנעילה כדי שפוקוס הבא ינסה שוב
        standardsRef.current = null;
      });
  };

  const q = normalize(query.trim());
  const active = q.length >= 2;

  const results = useMemo(() => {
    if (!active) return null;
    const modules = [];
    for (const m of MODULE_INDEX) {
      const hit = m.fields.find((f) => f.norm.includes(q));
      if (hit) modules.push({ id: m.id, icon: m.icon, title: m.title, snippet: hit.text });
      if (modules.length >= 5) break;
    }
    const tofes4 = TOFES4_INDEX.filter((t) => t.norm.includes(q)).slice(0, 3);
    let standardsCount = 0;
    const mod = standardsReady ? standardsRef.current : null;
    if (mod?.STANDARD_DOMAINS) {
      for (const d of mod.STANDARD_DOMAINS) {
        for (const item of d.items) {
          if (normalize(`${item.code} ${item.desc} ${d.title}`).includes(q)) standardsCount++;
        }
      }
    }
    return { modules, tofes4, standardsCount };
  }, [q, active, standardsReady]);

  const empty =
    results && results.modules.length === 0 && results.tofes4.length === 0 && results.standardsCount === 0;

  return (
    <div className="print-hide">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={loadStandards}
        placeholder='חיפוש בכל הקורס… (למשל: ממ"ד, הארקה, מתזים)'
        aria-label="חיפוש בכל תוכן הקורס"
        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-magic"
      />
      {/* אזור חי — קוראי מסך שומעים כמה תוצאות נמצאו */}
      <p role="status" className="sr-only">
        {active && results
          ? empty
            ? "לא נמצאו תוצאות"
            : `נמצאו ${results.modules.length + results.tofes4.length} תוצאות ועוד ${results.standardsCount} בספריית התקנים`
          : ""}
      </p>
      {active && results && (
        <div className="mt-2 bg-white rounded-2xl shadow-sm divide-y divide-ink/5 overflow-hidden">
          {results.modules.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenModule(r.id)}
              className="w-full text-right px-4 py-3 hover:bg-magic/5 transition"
            >
              <p className="font-bold text-sm">
                <span aria-hidden>{r.icon}</span> {r.title}
              </p>
              <p className="text-xs text-ink/70 leading-relaxed mt-0.5">{snippet(r.snippet)}</p>
            </button>
          ))}
          {results.tofes4.map((r) => (
            <button
              key={r.id}
              onClick={() => onGoTab("tofes4")}
              className="w-full text-right px-4 py-3 hover:bg-magic/5 transition"
            >
              <p className="font-bold text-sm">
                <span aria-hidden>{r.icon}</span> טופס 4: {r.text}
              </p>
            </button>
          ))}
          {results.standardsCount > 0 && (
            <button
              onClick={() => onGoStandards(query.trim())}
              className="w-full text-right px-4 py-3 hover:bg-magic/5 transition"
            >
              <p className="font-bold text-sm">
                <span aria-hidden>📖</span> ספריית התקנים — {results.standardsCount} תוצאות
              </p>
              <p className="text-xs text-ink/70 mt-0.5">פתיחת החיפוש בספרייה המלאה</p>
            </button>
          )}
          {empty && (
            <p className="px-4 py-3 text-sm text-ink/70">
              לא נמצאו תוצאות. נסו מילה אחרת — או בדקו בספריית התקנים.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
