import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeBookletHtml } from "../lib/sanitize";
import Preview from "./Preview";
import BookletRating from "./BookletRating";
import UpgradeModal from "./UpgradeModal";
import { FREE_LIMIT } from "../hooks/useProfile";
import { track } from "../hooks/useEvents";
import { IS_INAPP } from "../lib/inapp";

const SUBJECTS = [
  ["חשבון", "➕"],
  ["עברית", "📖"],
  ["מדעים", "🔬"],
  ["אנגלית", "🌍"],
  ["כישורי חיים", "🌱"],
  ["היסטוריה", "📜"],
  ["גאוגרפיה", "🗺️"],
];
const WORLDS = ["כדורגל", "גיימינג", "חיות", "חלל", "בישול", "מוזיקה", "סוסים", "נינג'ה", "פוקימון", "מינקראפט"];
const PAGE_OPTIONS = [2, 5, 7, 10];
const LOADING_MSGS = [
  "קורא את הבקשה שלך...",
  "מתכנן את מבנה החוברת...",
  "כותב תרגילים ומשימות...",
  "מעצב עמודי A4...",
  "מוסיף צבעים ואימוג'ים...",
  "עוד קצת בסבלנות, זה כבר בדרך...",
  "בודק איכות ומסיים...",
  "כמעט מוכן! עוד רגע...",
];

export default function QuickCreate({ student, onClose, onSaved, remaining, isPro, bookletCount = 0, initialSubject = "", initialWorld = "כדורגל" }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subject, setSubject]       = useState(initialSubject);
  const [world, setWorld]           = useState(student.worlds?.[0] || initialWorld);
  const [specificGoal, setSpecificGoal] = useState("");
  const [pageCount, setPageCount]   = useState(isPro ? 5 : 2);
  const [loading, setLoading]       = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [html, setHtml]             = useState(null);
  const [bookletId, setBookletId]   = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const [error, setError]           = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [rateCountdown, setRateCountdown] = useState(null);
  const streamAbortRef = useRef(null);
  const creatingRef = useRef(false);   // prevent double-submit (fast double-tap)

  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); setStreamChars(0); return; }
    const id = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 3500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const match = error?.match?.(/^rate:(\d+)$/);
    setRateCountdown(match ? parseInt(match[1]) : null);
  }, [error]);

  useEffect(() => {
    if (!rateCountdown || rateCountdown <= 0) {
      if (rateCountdown === 0) setError(null);
      return;
    }
    const t = setTimeout(() => setRateCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [rateCountdown]);

  // Abort any in-flight SSE stream on unmount
  useEffect(() => () => streamAbortRef.current?.abort(), []);

  // Gate at render time — a free user with 0 remaining shouldn't fill the whole
  // form only to get the server's quota error after a round-trip.
  const quotaExhausted = !isPro && typeof remaining === "number" && remaining <= 0;
  const canSubmit = !loading && subject.length > 0 && !quotaExhausted;

  const create = useCallback(async () => {
    if (!canSubmit || creatingRef.current) return;
    creatingRef.current = true;
    setLoading(true);
    setHtml(null);
    setError(null);

    const trackError = (type, extra = {}) => track("booklet_error", { type, mode: "student_quick", ...extra });
    track("booklet_started", { mode: "student_quick", subject, world, grade: student?.grade, pages: pageCount });

    const goal = specificGoal.trim() ? `${subject} — ${specificGoal.trim()}` : subject;

    const body = {
      childName: student.name,
      grade: student.grade,
      world,
      goal,
      level: student.level || "medium",
      pageCount,
      withAnswerKey: false,
      weaknesses: student.special_needs || "",
      ...(student.photo_url ? { childPhotoUrl: student.photo_url } : {}),
    };
    if (IS_INAPP) body.noStream = true;   // WhatsApp/Instagram webviews can't read SSE

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      creatingRef.current = false;
      trackError("no_session");
      setError("אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }

    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/generate-booklet`;
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    let resp;
    try {
      resp = await fetch(fnUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      setLoading(false);
      creatingRef.current = false;
      if (ctrl.signal.aborted) return;
      trackError("network", { message: String(e?.message ?? e).slice(0, 120) });
      setError("בעיית תקשורת — בדקי את החיבור לאינטרנט ונסי שוב 🙏");
      return;
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      setLoading(false);
      creatingRef.current = false;
      if (errData?.error === "quota_exceeded") {
        const monthly = errData?.period === "monthly";
        trackError(monthly ? "quota_monthly" : "quota");
        setError(monthly ? "quota_monthly" : "quota");
        return;
      }
      if (errData?.error === "rate_limited") {
        const wait = errData?.wait ?? 60;
        trackError("rate_limited", { wait });
        setError(`rate:${wait}`);
        return;
      }
      trackError("server_error", { status: resp.status });
      setError(`שגיאת שרת ${resp.status}`);
      return;
    }

    let htmlAccumulated = "";
    let streamHadError = false;
    let streamErrorMsg = null;
    let stopReason = null;
    let streamAborted = false;

    if (IS_INAPP) {
      // In-app browser (WhatsApp/Instagram) can't read SSE — the server returns the
      // whole booklet in one JSON instead (body.noStream above).
      try {
        const j = await resp.json();
        htmlAccumulated = j?.html ?? "";
      } catch {
        if (ctrl.signal.aborted) { creatingRef.current = false; return; }
        setLoading(false);
        creatingRef.current = false;
        trackError("nostream_parse_failed");
        setError("לא הצלחנו לקבל את החוברת — נסי שוב 🙏");
        return;
      }
    } else {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let updateTimer = 0;
      // Stall guards: a hung Anthropic stream keeps the HTTP connection alive via the
      // server's keep-alive heartbeats, so without these reader.read() can hang for
      // minutes with zero progress. Bail out instead of spinning forever.
      const DEAD_CONN_MS = 30000;     // no bytes at all (not even a heartbeat) → dead
      const CONTENT_STALL_MS = 90000; // alive but zero new HTML → stalled
      let lastContentAt = Date.now();
      try {
        while (true) {
          const readResult = await Promise.race([
            reader.read(),
            new Promise((res) => setTimeout(() => res("__dead__"), DEAD_CONN_MS)),
          ]);
          if (readResult === "__dead__") throw new Error("dead_connection");
          const { done, value } = readResult;
          if (done) break;
          const beforeLen = htmlAccumulated.length;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const ev = JSON.parse(raw);
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                htmlAccumulated += ev.delta.text;
                const now = Date.now();
                if (now - updateTimer > 100) { setStreamChars(htmlAccumulated.length); updateTimer = now; }
              } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
                stopReason = ev.delta.stop_reason;
              } else if (ev.type === "error") {
                streamHadError = true;
                streamErrorMsg = ev.error?.type === "overloaded_error"
                  ? "השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"
                  : "שגיאת AI — נסי שוב";
              }
            } catch {}
            if (streamHadError) break;
          }
          if (htmlAccumulated.length > beforeLen) lastContentAt = Date.now();
          else if (Date.now() - lastContentAt > CONTENT_STALL_MS) throw new Error("content_stalled");
          if (streamHadError) break;
        }
      } catch {
        if (ctrl.signal.aborted) { creatingRef.current = false; return; } // unmounted/closed mid-stream
        // Kill the zombie connection — otherwise the server-side generation keeps
        // running (double API cost) and contends with the per-user rate limit.
        ctrl.abort();
        const partial = htmlAccumulated.trim();
        if (partial.length > 8000 && (partial.includes("<!DOCTYPE") || partial.includes("<html"))) {
          if (!partial.includes("</html>")) htmlAccumulated = partial + "\n</body></html>";
          streamAborted = true;
          // Fall through to save the partial booklet
        } else {
          setLoading(false);
          creatingRef.current = false;
          trackError("stream_dropped");
          setError("החיבור נקטע — נסה שנית, רצוי עם פחות עמודים");
          return;
        }
      }
    }

    if (streamHadError) {
      setLoading(false);
      creatingRef.current = false;
      trackError("ai_stream_error");
      setError(streamErrorMsg || "שגיאת AI — נסי שוב");
      return;
    }

    // Token-budget truncation ends the stream "normally" but the booklet is
    // incomplete — close the tags and mark it partial like a dropped stream.
    if (stopReason === "max_tokens") {
      streamAborted = true;
      if (!htmlAccumulated.includes("</html>")) htmlAccumulated = htmlAccumulated.trim() + "\n</body></html>";
    }

    setLoading(false);
    creatingRef.current = false;
    const rawHtml = htmlAccumulated.trim();
    if (!rawHtml || !rawHtml.includes("<")) { trackError("empty_html"); setError("לא התקבל HTML תקין מהשרת"); return; }
    const finalHtml = sanitizeBookletHtml(rawHtml);

    const userId = session.user?.id;
    if (!userId) {
      trackError("no_session");
      setError("אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }
    const { data: inserted, error: insertErr } = await supabase.from("booklets").insert({
      user_id: userId,
      child_id: student.id,
      title: `${student.name} — ${goal}${streamAborted ? " (חלקי)" : ""}`,
      child_name: student.name,
      grade: student.grade,
      world,
      goal,
      level: student.level || "medium",
      html: finalHtml,
    }).select("id, share_token").single();
    if (insertErr) {
      // Don't discard a ~90s generation — show the booklet anyway, just without a cloud copy.
      // Don't call onSaved here — it would close the panel and the user would lose the booklet view.
      trackError("db_insert_failed", { message: insertErr.message });
      track("booklet_completed", { booklet_id: null, pages: pageCount, mode: "student_quick", child_id: student?.id, save_failed: true });
      setSaveWarning(true);
      setHtml(finalHtml);
      return;
    }

    setBookletId(inserted?.id ?? null);
    setShareToken(inserted?.share_token ?? null);
    if (streamAborted) setSaveWarning(true);
    setShowRating(true);
    setHtml(finalHtml);
    track("booklet_completed", { booklet_id: inserted?.id, pages: pageCount, mode: "student_quick", child_id: student?.id, booklet_index: bookletCount + 1 });
    onSaved?.();
  }, [canSubmit, student, subject, world, specificGoal, pageCount, onSaved, bookletCount]);

  if (html) {
    return (
      <section className="space-y-4">
        {saveWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-right">
            <p className="font-bold text-amber-800 text-sm">⚠️ החוברת נוצרה אבל לא נשמרה בענן</p>
            <p className="text-xs text-amber-700 mt-1">הדפיסי אותה עכשיו כדי לא לאבד אותה. היסטוריה לא תציג חוברת זו.</p>
          </div>
        )}
        {showRating && bookletId ? (
          <BookletRating
            bookletId={bookletId}
            studentName={student.name}
            onDone={() => setShowRating(false)}
          />
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-4">
              <span className="text-xl">{saveWarning ? "⚠️" : "✅"}</span>
              <span>החוברת {saveWarning ? "נוצרה (לא נשמרה)" : "נוצרה"} עבור {student.name}!</span>
            </div>
            <Preview html={html} onReset={onClose} shareToken={shareToken} context="quick" bookletId={bookletId} />
          </div>
        )}
      </section>
    );
  }

  return (
    <>
    {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} source="quick_create" />}
    <div className="bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-magic/10 to-brand/10 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">✨ צור חוברת</h2>
            <p className="text-sm text-ink/50 mt-0.5">
              {student.name} · {student.grade}
              {student.special_needs && (
                <span className="mr-2 text-amber-500 text-xs" title={student.special_needs}>📌</span>
              )}
            </p>
          </div>
          <button onClick={() => { track("quick_create_closed", { generated: !!html }); onClose?.(); }} aria-label="סגור" className="text-ink/30 hover:text-ink text-2xl leading-none mt-0.5">×</button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Subject chips */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium uppercase tracking-wide">מקצוע *</p>
          <div className="flex gap-2 flex-wrap">
            {SUBJECTS.map(([s, icon]) => (
              <button
                key={s}
                onClick={() => { setSubject(s); track("subject_chip_clicked", { subject: s }); }}
                disabled={loading}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  subject === s
                    ? "bg-magic text-white border-magic shadow-sm"
                    : "bg-canvas/50 border-ink/15 text-ink/70 hover:border-magic/50"
                }`}
              >
                {icon} {s}
              </button>
            ))}
          </div>
        </div>

        {/* World (interest) */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium uppercase tracking-wide">עולם תוכן (אינטרס)</p>
          <select
            className="w-full border border-ink/20 rounded-xl p-3 bg-canvas/50 text-right outline-none focus:border-magic"
            value={world}
            onChange={e => { setWorld(e.target.value); track("world_selected", { world: e.target.value }); }}
            disabled={loading}
          >
            {WORLDS.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>

        {/* Optional specific goal */}
        <input
          className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50 text-sm"
          placeholder={`יעד ספציפי (אופציונלי) — למשל: "חיבור וחיסור עד 100"`}
          value={specificGoal}
          onChange={e => setSpecificGoal(e.target.value)}
          disabled={loading}
        />

        {/* Page count */}
        <div>
          <p className="text-xs text-ink/40 mb-2 font-medium">כמות עמודים</p>
          <div className="flex gap-2">
            {PAGE_OPTIONS.map(n => {
              const isLocked = !isPro && n > 2;
              return (
                <button
                  key={n}
                  onClick={() => {
                    if (isLocked) { track("upgrade_intent_clicked", { source: "quick_create_pages" }); setShowUpgrade(true); return; }
                    setPageCount(n);
                    track("page_count_selected", { pages: n });
                  }}
                  disabled={loading}
                  className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors relative ${
                    isLocked
                      ? "bg-canvas/30 border-ink/10 text-ink/30 cursor-pointer"
                      : pageCount === n
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-brand/50"
                  }`}
                >
                  {isLocked && <span className="absolute -top-1 -right-1 text-[9px]">🔒</span>}
                  {n} עמ'
                </button>
              );
            })}
          </div>
          {!isPro && <p className="text-[10px] text-ink/30 mt-1 text-center">מעל 2 עמודים זמינים בתוכנית בתשלום</p>}
        </div>

        {/* Errors */}
        {rateCountdown > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm text-center">
            ⏳ יש להמתין עוד {rateCountdown} שניות לפני יצירה נוספת
          </div>
        )}
        {error && error !== "quota" && error !== "quota_monthly" && !rateCountdown && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error.replace(/^generic:/, "")}</div>
        )}
        {(error === "quota" || (quotaExhausted && !error)) && (
          <div className="space-y-3">
            <p className="text-ink/60 text-sm text-center">ניצלת את {FREE_LIMIT} החוברות החינמיות</p>
            <button
              onClick={() => { track("upgrade_intent_clicked", { source: "quick_create_quota" }); setShowUpgrade(true); }}
              className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-semibold text-center hover:opacity-90 transition-opacity"
            >
              🚀 שדרגי — מ-₪19/חודש
            </button>
          </div>
        )}
        {error === "quota_monthly" && (
          <div className="space-y-3 text-center">
            <p className="text-ink/70 text-sm font-semibold">📅 הגעת למכסה החודשית</p>
            <p className="text-ink/50 text-xs">המכסה מתחדשת בתחילת החודש. צריך יותר? שלחי הודעה ונרחיב.</p>
            <a
              href={`https://wa.me/972509139137?text=${encodeURIComponent("שלום! הגעתי למכסה החודשית — אפשר להרחיב?")}`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full bg-[#25D366] text-white rounded-xl p-3 font-semibold text-center hover:opacity-90 transition-opacity"
            >
              💬 שלחי הודעה
            </a>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8 space-y-3" role="status" aria-live="polite">
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-ink/60 text-sm font-medium">{LOADING_MSGS[loadingMsgIdx]}</p>
            {streamChars > 0
              ? <p className="text-magic text-xs font-mono">{streamChars.toLocaleString("he-IL")} תווים נכתבו...</p>
              : <p className="text-ink/30 text-xs">{pageCount} עמודי A4 · 30–90 שניות</p>
            }
            <div className="w-full bg-canvas rounded-full h-1.5 overflow-hidden">
              {streamChars > 0
                ? <div className="h-full bg-gradient-to-r from-brand via-magic to-grow rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(95, (streamChars / (pageCount * 3200)) * 100)}%` }} />
                : <div className="h-full bg-gradient-to-r from-brand via-magic to-grow rounded-full animate-shimmer" />
              }
            </div>
          </div>
        )}

        {/* Submit */}
        {!loading && error !== "quota" && !quotaExhausted && (
          <button
            onClick={create}
            disabled={!canSubmit}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm"
          >
            ✨ צור חוברת עבור {student.name} ({pageCount} עמ')
          </button>
        )}
      </div>
    </div>
    </>
  );
}
