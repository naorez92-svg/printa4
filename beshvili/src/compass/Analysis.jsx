import { useEffect, useRef, useState } from "react";
import { streamAnalysis, parseReport } from "./api";
import { Btn, CompassMark } from "./ui";

// מצפן — the multi-agent analysis screen. Three specialist agents run in
// parallel on the server; their status animates here, then the synthesizer's
// report streams in live. On completion the parsed report is stored on the
// journey and we advance to the report stage.

const AGENT_DEFS = [
  { key: "psych",    icon: "🧠", label: "פסיכולוג תעסוקתי",     desc: "מנתח אישיות, ערכים ומוטיבציות עומק" },
  { key: "aptitude", icon: "⚡", label: "מומחה חוזקות ולמידה",  desc: "ממפה יכולות וסגנון למידה מתאים" },
  { key: "market",   icon: "📊", label: "אסטרטג שוק העבודה",    desc: "סורק כיוונים ריאליים בשוק הישראלי" },
];

export default function Analysis({ journey, update, ensureRow, goToStage }) {
  const [agentState, setAgentState] = useState({});   // key -> "running"|"done"
  const [phase, setPhase] = useState("starting");     // starting|agents|synthesis|error
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const rawRef = useRef("");
  const streamBoxRef = useRef(null);

  const run = async () => {
    setPhase("starting");
    setError("");
    setAgentState({});
    rawRef.current = "";
    setStreamed("");
    try {
      const rowId = journey.rowId || (await ensureRow());
      if (!rowId) throw Object.assign(new Error("no_row"), { code: "no_row" });
      await streamAnalysis(rowId, journey.answers, journey.interview, (evt) => {
        if (evt.type === "agents_start") {
          setPhase("agents");
          setAgentState(Object.fromEntries(AGENT_DEFS.map((a) => [a.key, "running"])));
        } else if (evt.type === "agent_done") {
          setAgentState((s) => ({ ...s, [evt.key]: "done" }));
        } else if (evt.type === "synthesis_start") {
          setPhase("synthesis");
        } else if (evt.type === "delta") {
          rawRef.current += evt.text;
          setStreamed(rawRef.current);
        } else if (evt.type === "done") {
          const raw = rawRef.current;
          const sections = parseReport(raw);
          update({ report: { raw, sections }, stage: "report" });
        } else if (evt.type === "error") {
          throw Object.assign(new Error(evt.error), { code: evt.error });
        }
      });
      // Stream closed without a "done" event and without a stored report —
      // treat whatever arrived as the report if it's substantial, else error.
      if (!journey.report && rawRef.current.length > 400) {
        const raw = rawRef.current;
        update({ report: { raw, sections: parseReport(raw) }, stage: "report" });
      } else if (rawRef.current.length <= 400) {
        setPhase("error");
        setError("הניתוח נקטע באמצע. נסה שוב 🙏");
      }
    } catch (e) {
      setPhase("error");
      if (e.code === "rate_limited") setError(`המערכת עמוסה רגע — נסה שוב בעוד ${e.wait || 45} שניות`);
      else if (e.code === "journey_quota_exceeded" || e.code === "daily_limit") setError("הגעת למגבלת הניתוחים להיום. חזור מחר — ההתקדמות שלך שמורה.");
      else setError("משהו השתבש בניתוח. נסה שוב עוד רגע 🙏");
    }
  };

  useEffect(() => {
    if (startedRef.current) return; // guard StrictMode double-mount + re-renders
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the live stream box pinned to the newest text.
  useEffect(() => {
    if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
  }, [streamed]);

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.4s_ease]">
      <div className="text-center mb-8">
        <CompassMark size={56} className="mx-auto mb-4 animate-spin [animation-duration:6s]" />
        <h2 className="text-2xl font-bold font-display mb-1">
          {phase === "synthesis" ? "המצפן שלך נכתב ברגעים אלה…" : "צוות המומחים מנתח את המסע שלך"}
        </h2>
        <p className="text-white/45 text-sm">זה לוקח בין דקה לשלוש. שווה כל שנייה.</p>
      </div>

      <div className="space-y-3 mb-6">
        {AGENT_DEFS.map((a) => {
          const st = agentState[a.key];
          return (
            <div key={a.key} className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-500 ${
              st === "done" ? "bg-grow/10 border-grow/40"
              : st === "running" ? "bg-white/5 border-magic/40"
              : "bg-white/5 border-white/10 opacity-50"
            }`}>
              <div className="text-2xl">{a.icon}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{a.label}</div>
                <div className="text-xs text-white/40">{a.desc}</div>
              </div>
              {st === "done" ? (
                <span className="text-grow text-lg">✓</span>
              ) : st === "running" ? (
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-magic rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {phase === "synthesis" && (
        <div
          ref={streamBoxRef}
          className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 max-h-44 overflow-hidden text-sm text-white/50 leading-relaxed whitespace-pre-wrap"
        >
          {streamed.replace(/@@[^@\n]+@@/g, "").slice(-1200) || "…"}
        </div>
      )}

      {phase === "error" && (
        <div className="text-center space-y-4">
          <p className="text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">{error}</p>
          <Btn onClick={() => run()}>נסה שוב</Btn>
          <div>
            <button onClick={() => goToStage("open")} className="text-xs text-white/35 hover:text-white/60 underline">
              חזרה לשאלות העומק
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
