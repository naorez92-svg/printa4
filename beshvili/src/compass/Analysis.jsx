import { useEffect, useRef, useState } from "react";
import { track } from "../hooks/useEvents";
import { streamExperts, streamSynthesis, parseReport } from "./api";
import { Btn, CompassMark } from "./ui";

// מצפן — the two-phase analysis screen.
// Phase 1 (experts): three specialist agents run server-side in parallel; their
// analyses are persisted to the journey row, so retries never re-run them.
// Phase 2 (synthesize): the synthesizer streams the report live (raw Anthropic
// SSE, parsed here); the server persists the final report independently of us.

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
  const rawRef = useRef("");
  const doneRef = useRef(false);       // set only by the server's synthesis "done"
  const lastFlushRef = useRef(0);
  const abortRef = useRef(null);
  const streamBoxRef = useRef(null);

  const finishWithReport = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const raw = rawRef.current;
    track("compass_report_ready", { chars: raw.length });
    update({ report: { raw, sections: parseReport(raw) }, stage: "report" });
  };

  const run = async () => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    doneRef.current = false;
    rawRef.current = "";
    setPhase("starting");
    setError("");
    setAgentState({});
    setStreamed("");
    track("compass_analysis_started", {});
    try {
      const rowId = journey.rowId || (await ensureRow());
      if (!rowId) throw Object.assign(new Error("no_row"), { code: "no_row" });

      // ── Phase 1: experts (replays instantly from cache on retry) ──
      let expertsDone = false;
      await streamExperts(rowId, journey.answers, journey.interview, (evt) => {
        if (evt.type === "agents_start") {
          setPhase("agents");
          setAgentState(Object.fromEntries(AGENT_DEFS.map((a) => [a.key, "running"])));
        } else if (evt.type === "agent_done") {
          setAgentState((s) => ({ ...s, [evt.key]: "done" }));
        } else if (evt.type === "experts_cached") {
          setAgentState(Object.fromEntries(AGENT_DEFS.map((a) => [a.key, "done"])));
        } else if (evt.type === "done") {
          expertsDone = true;
          setAgentState(Object.fromEntries(AGENT_DEFS.map((a) => [a.key, "done"])));
        } else if (evt.type === "error") {
          throw Object.assign(new Error(evt.error), { code: evt.error, phase: "experts" });
        }
      }, controller.signal);
      if (!expertsDone) throw Object.assign(new Error("experts_truncated"), { code: "ai_error" });

      // ── Phase 2: synthesis (raw Anthropic SSE + our control events) ──
      setPhase("synthesis");
      await streamSynthesis(rowId, journey.answers, journey.interview, (evt) => {
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          rawRef.current += evt.delta.text;
          if (Date.now() - lastFlushRef.current > 150) {
            lastFlushRef.current = Date.now();
            setStreamed(rawRef.current);
          }
        } else if (evt.type === "done") {
          finishWithReport();
        } else if (evt.type === "error") {
          throw Object.assign(new Error(evt.error), { code: evt.error, phase: "synthesis" });
        }
        // Other Anthropic events (message_start/stop, block start/stop) — ignore.
      }, controller.signal);
      // Stream closed without the server's "done" → the server didn't persist
      // a report; surface a retry (experts are cached, so it's cheap).
      if (!doneRef.current) {
        setPhase("error");
        setError("הכתיבה נקטעה באמצע. המומחים כבר סיימו — נסה שוב וזה ימשיך מהם 🙏");
      }
    } catch (e) {
      if (controller.signal.aborted) return; // unmounted / superseded — stay silent
      setPhase("error");
      if (e.code === "payment_required") { goToStage("paywall"); return; }
      if (e.code === "experts_missing") { setError("שלב המומחים לא הושלם — נסה שוב"); return; }
      if (e.code === "rate_limited") setError(`שנייה של נשימה — נסה שוב בעוד ${e.wait || 20} שניות`);
      else if (e.code === "journey_quota_exceeded" || e.code === "daily_limit") setError("הגעת למגבלת הניתוחים להיום. חזור מחר — הכל שמור.");
      else setError("משהו השתבש בניתוח. ההתקדמות שמורה — נסה שוב 🙏");
    }
  };

  useEffect(() => {
    // Deferred start: StrictMode's dev double-mount unmounts synchronously, so
    // the first mount's timer is cleared before the (billable) request fires.
    const t = setTimeout(run, 60);
    return () => { clearTimeout(t); abortRef.current?.abort(); };
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
        <p className="text-white/45 text-sm">זה לוקח כמה דקות. שווה כל שנייה — אל תסגור את המסך.</p>
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
          {streamed.slice(-1400).replace(/@@[^@\n]+@@/g, "").slice(-1200) || "…"}
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
