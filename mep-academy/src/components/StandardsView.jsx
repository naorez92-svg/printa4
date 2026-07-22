import { useMemo, useState } from "react";
import { STANDARD_DOMAINS, STANDARDS_COUNT } from "../data/standards.js";

// נרמול לחיפוש: גרשיים עבריים (״) ומרכאות מסולסלות מומרים למרכאות רגילות,
// ואותיות לטיניות מושוות ללא תלות ברישיות (nfpa ↔ NFPA).
function normalize(s) {
  return s.replace(/[”“״]/g, '"').replace(/[׳']/g, "'").toLowerCase();
}

export default function StandardsView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return STANDARD_DOMAINS;
    return STANDARD_DOMAINS.map((d) => ({
      ...d,
      items: d.items.filter(
        (it) =>
          normalize(it.code).includes(q) ||
          normalize(it.desc).includes(q) ||
          normalize(d.title).includes(q)
      ),
    })).filter((d) => d.items.length > 0);
  }, [query]);

  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h1 className="font-bold text-2xl mb-1">📖 ספריית התקנים</h1>
        <p className="text-white/90">
          {STANDARDS_COUNT} פריטי חקיקה ותקינה, מסודרים לפי תחום. התקנים מתעדכנים — לפני
          הסתמכות מקצועית ודאו את המהדורה העדכנית במכון התקנים.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='חיפוש תקן… (למשל: 1596, ממ"ד, חשמל)'
        aria-label="חיפוש בספריית התקנים"
        className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-magic"
      />

      {filtered.length === 0 && (
        <p role="status" className="text-center text-ink/70 py-8">לא נמצאו תקנים מתאימים לחיפוש.</p>
      )}

      {filtered.map((domain) => (
        <section key={domain.id} className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-lg mb-3">
            <span aria-hidden>{domain.icon}</span> {domain.title}
          </h3>
          <div className="space-y-3">
            {domain.items.map((item, i) => (
              <div key={i} className="bg-canvas rounded-xl p-4">
                <p className="font-mono font-semibold text-magic">{item.code}</p>
                <p className="text-sm leading-relaxed mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
