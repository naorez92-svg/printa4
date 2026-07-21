import { WHY_TOFES4, TOFES4_CHECKLIST, TOFES4_TIPS } from "../data/tofes4.js";

export default function Tofes4View({ checked, onToggle }) {
  const doneCount = TOFES4_CHECKLIST.filter((c) => checked[c.id]).length;
  const pct = Math.round((doneCount / TOFES4_CHECKLIST.length) * 100);

  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h2 className="font-bold text-2xl mb-1">📋 הכנה לטופס 4</h2>
        <p className="text-white/85">
          המסלול המלא לאישור האכלוס: למה הוא נקרא כך, מי צריך לאשר מה, ואיך מנהלים את זה
          בלי לאחר את המסירה.
        </p>
      </header>

      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-lg mb-3">❓ {WHY_TOFES4.title}</h3>
        <div className="space-y-3 leading-relaxed">
          {WHY_TOFES4.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg">🗂️ צ'ק־ליסט האישורים</h3>
          <span className="font-mono text-sm text-magic font-semibold">
            {doneCount}/{TOFES4_CHECKLIST.length}
          </span>
        </div>
        <p className="text-sm text-ink/60 mb-3">
          רשימת הרשויות והאישורים הנפוצים. כל ועדה מקומית רשאית להוסיף דרישות — בדקו את
          גיליון הדרישות של ההיתר שלכם.
        </p>
        <div className="h-2 bg-canvas rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-grow rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="space-y-3">
          {TOFES4_CHECKLIST.map((item) => {
            const isDone = !!checked[item.id];
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={`w-full text-right rounded-xl border p-4 transition ${
                  isDone ? "bg-grow/10 border-grow" : "bg-canvas border-transparent hover:border-magic/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>
                    {isDone ? "✅" : item.icon}
                  </span>
                  <div>
                    <p className="font-bold">
                      {item.authority} — {item.what}
                    </p>
                    <p className="text-sm text-ink/70 leading-relaxed mt-1">{item.requires}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-bold text-lg mb-3">💡 איך מקבלים את הטופס בזמן</h3>
        <ol className="space-y-2 list-decimal pr-5">
          {TOFES4_TIPS.map((tip, i) => (
            <li key={i} className="leading-relaxed">{tip}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
