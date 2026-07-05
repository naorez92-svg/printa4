import { useEffect, useRef, useState } from "react";
import { STAGE_INTROS } from "./data/questions";
import { fetchInterviewQuestion } from "./api";
import { Btn, StageIntro, CompassMark, MicButton } from "./ui";

// מצפן — the adaptive AI interview. A chat-like flow: the interviewer agent
// reads the whole assessment and asks up to 5 personalized questions, one at
// a time. Each Q&A pair is appended to journey.interview.

export default function Interview({ journey, update, ensureRow, nextStage }) {
  const intro = STAGE_INTROS.interview;
  const [started, setStarted] = useState(() => journey.interview.length > 0);
  const [pendingQ, setPendingQ] = useState(null);   // current unanswered question
  const [progress, setProgress] = useState({ index: journey.interview.length, total: 5 });
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fetching = useRef(false);
  const bottomRef = useRef(null);

  const loadNext = async (interviewSoFar) => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError("");
    try {
      const rowId = journey.rowId || (await ensureRow());
      if (!rowId) throw Object.assign(new Error("no_row"), { code: "no_row" });
      const data = await fetchInterviewQuestion(rowId, journey.answers, interviewSoFar);
      if (data.done) { nextStage(); return; }
      setPendingQ(data.question);
      setProgress({ index: data.index, total: data.total });
    } catch (e) {
      if (e.code === "rate_limited") {
        setError(`רגע אחד… נסה שוב בעוד ${e.wait || 10} שניות`);
      } else if (e.code === "journey_quota_exceeded" || e.code === "daily_limit") {
        setError("הגעת למגבלת השימוש להיום — אפשר להמשיך ישר לניתוח");
      } else {
        setError("משהו השתבש בדרך. נסה שוב עוד רגע 🙏");
      }
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (started && !pendingQ && !loading) loadNext(journey.interview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [journey.interview.length, pendingQ, loading]);

  if (!started) {
    return <StageIntro icon="🎙️" title={intro.title} text={intro.text} minutes={8} onStart={() => setStarted(true)} />;
  }

  const submit = () => {
    if (draft.trim().length < 10 || !pendingQ) return;
    const nextInterview = [...journey.interview, { q: pendingQ, a: draft.trim().slice(0, 2000) }];
    update({ interview: nextInterview });
    setPendingQ(null);
    setDraft("");
    if (nextInterview.length >= progress.total) nextStage();
    else loadNext(nextInterview);
  };

  return (
    <div className="flex-1 flex flex-col animate-[fadeIn_0.3s_ease]">
      <div className="text-xs text-white/35 mb-4">שאלה {Math.min(progress.index || journey.interview.length + 1, progress.total)} מתוך {progress.total}</div>

      <div className="flex-1 space-y-4 mb-5 overflow-y-auto">
        {journey.interview.map((qa, i) => (
          <div key={i} className="space-y-3">
            <AgentBubble text={qa.q} />
            <div className="flex justify-start">
              <div className="bg-magic/20 border border-magic/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-white/85 leading-relaxed text-sm">
                {qa.a}
              </div>
            </div>
          </div>
        ))}
        {pendingQ && <AgentBubble text={pendingQ} highlight />}
        {loading && (
          <div className="flex items-center gap-2 text-white/40 text-sm pr-1">
            <CompassMark size={20} className="animate-spin [animation-duration:3s]" />
            המראיין חושב על השאלה הבאה…
          </div>
        )}
        {error && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span>{error}</span>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => loadNext(journey.interview)} className="underline hover:text-red-200">נסה שוב</button>
              <button onClick={nextStage} className="underline hover:text-red-200">דלג לניתוח</button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {pendingQ && (
        <div className="sticky bottom-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full bg-ink/90 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-magic transition-colors leading-relaxed"
            placeholder="ענה בכנות ובהרחבה… או לחץ 🎤 ודבר"
          />
          <div className="flex justify-between items-center gap-2 mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <MicButton onText={(t) => setDraft((d) => `${d} ${t}`.trim().slice(0, 2000))} />
              <span className="text-xs text-white/30">{draft.trim().length < 10 ? "כמה מילים לפחות…" : ""}</span>
            </div>
            <Btn onClick={submit} disabled={draft.trim().length < 10}>
              {journey.interview.length + 1 >= progress.total ? "סיום הראיון ←" : "שלח ←"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentBubble({ text, highlight }) {
  return (
    <div className="flex justify-end items-start gap-2.5">
      <div className={`rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] leading-relaxed ${
        highlight ? "bg-white/10 border border-brand/40 text-white" : "bg-white/5 border border-white/10 text-white/80"
      }`}>
        {text}
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-magic to-brand flex items-center justify-center flex-shrink-0 text-sm mt-1">
        🎙️
      </div>
    </div>
  );
}
