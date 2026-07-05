import { useEffect, useRef, useState } from "react";
import { track } from "../hooks/useEvents";
import { askFollowup, fetchFollowupHistory } from "./api";
import { Btn, CompassMark, MicButton, Rich, richInline } from "./ui";

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

// "### תקופה" chunks → [{period, items: [task lines]}]. Each task line becomes
// a checkable item in the live action plan (the report's return-visit hook).
function parseRoadmap(text = "") {
  return splitH3(text).chunks.map((chunk) => {
    const [head, ...rest] = chunk.split("\n");
    const items = rest
      .map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, "").trim())
      .filter(Boolean);
    return { period: head.trim(), items };
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

// ── "שאל את הפסיכולוג" — post-report follow-up chat (server caps at 5) ──
const FOLLOWUP_MAX = 5;

// Index of the newest pending (unanswered) exchange — resolve/rollback target
// even if the history fetch reshuffled the array meanwhile.
const lastPendingIdx = (c) => {
  for (let i = c.length - 1; i >= 0; i--) if (c[i].a === null) return i;
  return -1;
};

function FollowupChat({ journey }) {
  const [chat, setChat] = useState([]);
  const [capped, setCapped] = useState(false); // server said followup_limit
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    // Never clobber a conversation the user already started while the
    // history SELECT was in flight.
    fetchFollowupHistory(journey.rowId)
      .then((h) => setChat((c) => (c.length ? c : h)), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.rowId]);

  useEffect(() => {
    if (chat.length || busy) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.length, busy]);

  const remaining = capped ? 0 : Math.max(0, FOLLOWUP_MAX - chat.length);

  const send = async () => {
    const q = input.trim();
    if (q.length < 2 || busy || remaining === 0) return;
    track("compass_followup_ask", { n: chat.length + 1 });
    setBusy(true);
    setError("");
    setInput("");
    setChat((c) => [...c, { q, a: null }]);
    try {
      const { answer, remaining: left } = await askFollowup(journey.rowId, q, journey.answers, journey.interview);
      setChat((c) => {
        const i = lastPendingIdx(c);
        if (i < 0) return c;
        const n = [...c];
        n[i] = { ...n[i], a: answer };
        return n;
      });
      if (left <= 0) setCapped(true);
    } catch (e) {
      setChat((c) => {
        const i = lastPendingIdx(c);
        return i < 0 ? c : c.filter((_, j) => j !== i);
      });
      setInput(q); // give the question back — nothing typed is lost
      if (e.code === "rate_limited") setError(`רגע אחד… נסה שוב בעוד ${e.wait || 10} שניות`);
      else if (e.code === "followup_limit") { setCapped(true); setError("נוצלו כל שאלות ההמשך למסע הזה"); }
      else if (e.code === "report_missing") setError("הצ'אט ייפתח כמה דקות אחרי שהדוח מוכן — נסה שוב עוד רגע");
      else setError("משהו השתבש — נסה שוב עוד רגע 🙏");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-gradient-to-br from-magic/15 to-white/5 border border-magic/30 rounded-3xl p-6 sm:p-8 print:hidden">
      <h2 className="text-xl font-bold font-display mb-1 flex items-center gap-2.5">
        <span className="text-2xl">🧑‍⚕️</span>שאל את הפסיכולוג
      </h2>
      <p className="text-sm text-white/50 mb-5">
        יש לך השגות? משהו בדוח לא מסתדר לך? הפסיכולוג התעסוקתי שניתח אותך כאן —
        עד {FOLLOWUP_MAX} שאלות המשך ({remaining} נותרו).
      </p>

      <div className="space-y-4 mb-4">
        {chat.map((m, i) => (
          <div key={i} className="space-y-2.5">
            <div className="flex justify-start">
              <div className="bg-magic/20 border border-magic/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[88%] text-sm leading-relaxed">{m.q}</div>
            </div>
            <div className="flex justify-end items-start gap-2">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[88%] text-sm">
                {m.a === null
                  ? <span className="flex items-center gap-2 text-white/40"><CompassMark size={16} className="animate-spin [animation-duration:3s]" /> חושב על זה ברצינות…</span>
                  : <Rich text={m.a} />}
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-magic to-brand flex items-center justify-center flex-shrink-0 text-xs mt-1">🧑‍⚕️</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-amber-300 mb-3">{error}</p>}

      {remaining > 0 ? (
        <div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 600))}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="למשל: למה דווקא הכיוון הזה ולא…?"
              className="flex-1 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 outline-none focus:border-magic transition-colors text-sm"
            />
            <Btn onClick={send} disabled={busy || input.trim().length < 2}>שלח</Btn>
          </div>
          <div className="mt-2">
            <MicButton onText={(t) => setInput((v) => `${v} ${t}`.trim().slice(0, 600))} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/45">
          נוצלו כל {FOLLOWUP_MAX} השאלות למסע הזה. רוצה ליווי אישי מעבר?{" "}
          <a href="https://wa.me/972509139137" target="_blank" rel="noreferrer" className="text-magic underline hover:text-magic/80">דבר איתנו בוואטסאפ</a>
        </p>
      )}
    </section>
  );
}

export default function Report({ journey, restart, update }) {
  const { sections = {}, raw = "" } = journey.report || {};
  const name = journey.answers?.background?.name || "";
  const done = journey.roadmapDone || {};
  const toggleTask = (key) => {
    track("compass_roadmap_toggle", { key, done: !done[key] });
    update((prev) => {
      const next = { ...(prev.roadmapDone || {}) };
      if (next[key]) delete next[key];
      else next[key] = true;
      return { ...prev, roadmapDone: next };
    });
  };
  const essence = sections["תמצית"];
  const profile = sections["פרופיל"];
  const { intro, items: directions } = parseDirections(sections["כיוונים"]);
  const bottomLine = sections["שורה_תחתונה"]; // the decisive pick + 30-day reality test
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
            <section className="bg-gradient-to-br from-magic/25 to-brand/15 border border-magic/40 rounded-3xl p-6 sm:p-8 print-avoid">
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
                  <div key={i} className={`rounded-2xl border p-5 print-avoid ${i === 0 ? "bg-brand/10 border-brand/40" : "bg-white/5 border-white/10"}`}>
                    {/* Badge → title → full-width fit bar: long Hebrew titles
                        wrap cleanly and the % never spills out of the card. */}
                    {i === 0 && (
                      <span className="inline-block text-xs bg-brand text-ink rounded-full px-2.5 py-0.5 font-bold mb-2">
                        ההתאמה הגבוהה ביותר
                      </span>
                    )}
                    <h3 className="font-bold text-lg leading-snug mb-2">{d.title}</h3>
                    {d.fit !== null && (
                      <div className="flex items-center gap-2.5 mb-4" dir="ltr">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-magic to-brand" style={{ width: `${d.fit}%` }} />
                        </div>
                        <span className="text-sm font-bold text-brand flex-shrink-0">{d.fit}% התאמה</span>
                      </div>
                    )}
                    <Rich text={d.body} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {bottomLine && (
            <section className="bg-gradient-to-br from-brand/20 to-magic/10 border border-brand/40 rounded-3xl p-6 sm:p-8 print-avoid">
              <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2.5">
                <span className="text-2xl">⚖️</span>השורה התחתונה
              </h2>
              <div className="text-lg leading-relaxed"><Rich text={bottomLine} /></div>
            </section>
          )}

          {studies && (
            <SectionCard icon="🎓" title="מה ללמוד — התשובה">
              <Rich text={studies} />
            </SectionCard>
          )}

          {roadmap.length > 0 && (() => {
            const total = roadmap.reduce((n, s) => n + s.items.length, 0);
            const doneCount = roadmap.reduce(
              (n, s, si) => n + s.items.filter((_, li) => done[`${si}-${li}`]).length, 0);
            const pct = total ? Math.round((doneCount / total) * 100) : 0;
            return (
              <SectionCard icon="🗺️" title="מסלול הפעולה החי שלך" accent="border-grow/25">
                {/* Live progress — this is why the report is worth returning to */}
                <div className="mb-5 print:hidden">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-white/60">סמן כל צעד שהשלמת — ההתקדמות נשמרת בחשבון שלך</span>
                    <span className="font-bold text-grow flex-shrink-0">{doneCount}/{total}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-l from-grow to-magic transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  {pct === 100 && total > 0 && (
                    <p className="text-grow text-sm font-semibold mt-2">🎉 השלמת את כל המסלול — הכיוון כבר לא חלום, הוא בדרך</p>
                  )}
                </div>
                <div className="relative pr-5">
                  <div className="absolute right-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-magic via-brand to-grow" />
                  <div className="space-y-6">
                    {roadmap.map((step, si) => (
                      <div key={si} className="relative print-avoid">
                        <div className="absolute -right-5 top-1.5 w-3 h-3 rounded-full bg-brand ring-4 ring-ink" />
                        <h3 className="font-bold text-brand mb-2">{step.period}</h3>
                        <div className="space-y-1.5">
                          {step.items.map((task, li) => {
                            const key = `${si}-${li}`;
                            const checked = !!done[key];
                            return (
                              <button
                                key={key}
                                onClick={() => toggleTask(key)}
                                className="w-full flex items-start gap-2.5 text-right group"
                              >
                                <span className={`w-5 h-5 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold transition-all ${
                                  checked
                                    ? "bg-grow border-grow text-ink"
                                    : "border-white/25 group-hover:border-grow/60"
                                }`}>
                                  {checked ? "✓" : ""}
                                </span>
                                <span className={`leading-relaxed transition-colors ${checked ? "text-white/35 line-through" : "text-white/75"}`}>
                                  {richInline(task, key)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            );
          })()}

          {letter && (
            <section className="bg-white/5 border border-white/15 rounded-3xl p-6 sm:p-8 relative print-avoid">
              <div className="absolute top-5 left-6 text-4xl opacity-20">✉️</div>
              <h2 className="text-sm font-semibold text-white/50 tracking-wide mb-4">מכתב אישי, ממצפן אליך</h2>
              <div className="italic"><Rich text={letter} /></div>
            </section>
          )}

          <FollowupChat journey={journey} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 mt-10 print:hidden">
        <Btn onClick={() => { track("compass_report_print", {}); window.print(); }}>🖨️ שמור כ-PDF</Btn>
        <Btn ghost onClick={() => {
          if (window.confirm("להתחיל מסע חדש? הדוח הנוכחי יימחק מהמכשיר הזה.")) restart();
        }}>
          מסע חדש
        </Btn>
      </div>
      <p className="text-center text-xs text-white/25 mt-6 print:hidden">
        🔒 הדוח נשמר בחשבון שלך לתמיד — פשוט תיכנס עם אותו מייל, מכל מכשיר
      </p>
      <p className="text-center text-[11px] text-white/20 mt-2 print:hidden">
        מצפן · מבית בשבילי ✨ · <a href="/terms" className="underline hover:text-white/40">תקנון</a> · <a href="/privacy" className="underline hover:text-white/40">פרטיות</a>
      </p>
    </div>
  );
}
