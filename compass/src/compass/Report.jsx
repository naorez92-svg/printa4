import { Btn, CompassMark, Rich } from "./ui";

// מצפן — the final report. Renders the parsed sections from the synthesizer:
// תמצית (essence) → פרופיל (portrait) → כיוונים (ranked directions) →
// לימודים (studies) → מפת_דרכים (roadmap) → מכתב (personal letter).

// Split "### heading\nbody…" text. parts[0] is preamble text BEFORE the first
// ### — it must never become a card of its own (it renders separately).
function splitH3(text = "") {
  const parts = text.split(/^###\s*/m);
  return {
    preamble: (parts[0] || "").trim(),
    chunks: parts.slice(1).map((c) => c.trim()).filter(Boolean),
  };
}

// "### שם הכיוון | התאמה: 87%" chunks → {intro, items: [{title, fit, body}]}
function parseDirections(text = "") {
  const { preamble, chunks } = splitH3(text);
  return {
    intro: preamble,
    items: chunks.map((chunk) => {
      const [head, ...rest] = chunk.split("\n");
      const fitMatch = head.match(/התאמה:\s*(\d{1,3})\s*%/);
      return {
        title: head.replace(/\|.*$/, "").trim(),
        fit: fitMatch ? Math.min(100, parseInt(fitMatch[1], 10)) : null,
        body: rest.join("\n").trim(),
      };
    }),
  };
}

// "### תקופה" chunks → [{period, body}]
function parseRoadmap(text = "") {
  return splitH3(text).chunks.map((chunk) => {
    const [head, ...rest] = chunk.split("\n");
    return { period: head.trim(), body: rest.join("\n").trim() };
  });
}

function SectionCard({ icon, title, children, accent = "border-white/10" }) {
  return (
    <section className={`bg-white/5 border ${accent} rounded-3xl p-6 sm:p-8`}>
      <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2.5">
        <span className="text-2xl">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

export default function Report({ journey, restart }) {
  const { sections = {}, raw = "" } = journey.report || {};
  const name = journey.answers?.background?.name || "";
  const essence = sections["תמצית"];
  const profile = sections["פרופיל"];
  const { intro, items: directions } = parseDirections(sections["כיוונים"]);
  const studies = sections["לימודים"];
  const roadmap = parseRoadmap(sections["מפת_דרכים"]);
  const letter = sections["מכתב"];
  const parsed = essence || profile || directions.length > 0;

  return (
    <div className="animate-[fadeIn_0.6s_ease] pb-16">
      {/* Hero */}
      <div className="text-center pt-6 pb-10">
        <CompassMark size={64} className="mx-auto mb-4" />
        <p className="text-brand text-sm font-semibold tracking-wide mb-2">המסע הושלם</p>
        <h1 className="text-4xl font-bold font-display mb-3">
          המצפן של{name ? ` ${name}` : "ך"}
        </h1>
        <p className="text-white/50 max-w-md mx-auto">
          כל מה שגילינו במסע — מזוקק לכיוון, לתוכנית לימודים ולמפת דרכים.
        </p>
      </div>

      {!parsed ? (
        // Fallback: markers missing from the stream — show the raw report.
        <SectionCard icon="🧭" title="הדוח שלך">
          <Rich text={raw} />
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {essence && (
            <section className="bg-gradient-to-br from-magic/25 to-brand/15 border border-magic/40 rounded-3xl p-6 sm:p-8">
              <h2 className="text-sm font-semibold text-brand tracking-wide mb-3">התמצית</h2>
              <div className="text-lg leading-relaxed"><Rich text={essence} /></div>
            </section>
          )}

          {profile && (
            <SectionCard icon="🪞" title="מי אתה — הפורטרט המלא">
              <Rich text={profile} />
            </SectionCard>
          )}

          {directions.length > 0 && (
            <SectionCard icon="🎯" title="הכיוונים שלך" accent="border-brand/25">
              {intro && <div className="mb-5 text-white/60 text-sm"><Rich text={intro} /></div>}
              <div className="space-y-4">
                {directions.map((d, i) => (
                  <div key={i} className={`rounded-2xl border p-5 ${i === 0 ? "bg-brand/10 border-brand/40" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {i === 0 && <span className="text-xs bg-brand text-ink rounded-full px-2.5 py-0.5 font-bold">ההתאמה הגבוהה ביותר</span>}
                        {d.title}
                      </h3>
                      {d.fit !== null && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden" dir="ltr">
                            <div className="h-full bg-gradient-to-r from-magic to-brand" style={{ width: `${d.fit}%` }} />
                          </div>
                          <span className="text-sm font-bold text-brand">{d.fit}%</span>
                        </div>
                      )}
                    </div>
                    <Rich text={d.body} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {studies && (
            <SectionCard icon="🎓" title="מה ללמוד — התשובה">
              <Rich text={studies} />
            </SectionCard>
          )}

          {roadmap.length > 0 && (
            <SectionCard icon="🗺️" title="מפת הדרכים שלך" accent="border-grow/25">
              <div className="relative pr-5">
                <div className="absolute right-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-magic via-brand to-grow" />
                <div className="space-y-6">
                  {roadmap.map((step, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -right-5 top-1.5 w-3 h-3 rounded-full bg-brand ring-4 ring-ink" />
                      <h3 className="font-bold text-brand mb-2">{step.period}</h3>
                      <Rich text={step.body} />
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {letter && (
            <section className="bg-white/5 border border-white/15 rounded-3xl p-6 sm:p-8 relative">
              <div className="absolute top-5 left-6 text-4xl opacity-20">✉️</div>
              <h2 className="text-sm font-semibold text-white/50 tracking-wide mb-4">מכתב אישי, ממצפן אליך</h2>
              <div className="italic"><Rich text={letter} /></div>
            </section>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
        <Btn onClick={() => window.print()}>🖨️ שמור כ-PDF</Btn>
        <Btn ghost onClick={() => {
          if (window.confirm("להתחיל מסע חדש? הדוח הנוכחי יימחק מהמכשיר הזה.")) restart();
        }}>
          מסע חדש
        </Btn>
      </div>
      <p className="text-center text-xs text-white/25 mt-6">
        מצפן · מבית בשבילי ✨ · הדוח נשמר בחשבון שלך
      </p>
    </div>
  );
}
