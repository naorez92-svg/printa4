import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeBookletHtml } from "../lib/sanitize";
import Preview from "./Preview";
import BookletRating from "./BookletRating";
import UpgradeModal from "./UpgradeModal";
import { FREE_LIMIT } from "../hooks/useProfile";

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
const PAGE_OPTIONS = [3, 5, 7, 10];
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

export default function QuickCreate({ student, onClose, onSaved, remaining, isPro, initialSubject = "", initialWorld = "כדורגל" }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subject, setSubject]       = useState(initialSubject);
  const [world, setWorld]           = useState(student.worlds?.[0] || initialWorld);
  const [specificGoal, setSpecificGoal] = useState("");
  const [pageCount, setPageCount]   = useState(5);
  const [loading, setLoading]       = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [html, setHtml]             = useState(null);
  const [bookletId, setBookletId]   = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [error, setError]           = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [rateCountdown, setRateCountdown] = useState(null);
  const streamAbortRef = useRef(null);

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

  const canSubmit = !loading && subject.length > 0;

  const create = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setHtml(null);
    setError(null);

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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setError("אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }

    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-booklet`;
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
      if (ctrl.signal.aborted) return;
      setError(`שגיאת רשת — ${String(e)}`);
      return;
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      setLoading(false);
      if (errData?.error === "quota_exceeded") { setError("quota"); return; }
      if (errData?.error === "rate_limited") { setError(`rate:${errData?.wait ?? 60}`); return; }
      setError(`שגיאת שרת ${resp.status}`);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let htmlAccumulated = "";
    let updateTimer = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
            }
          } catch {}
        }
      }
    } catch {
      const partial = htmlAccumulated.trim();
      if (partial.length > 8000 && (partial.includes("<!DOCTYPE") || partial.includes("<html"))) {
        if (!partial.includes("</html>")) htmlAccumulated = partial + "\n</body></html>";
        // Fall through to save the partial booklet
      } else {
        setLoading(false);
        setError("החיבור נקטע — נסה שנית, רצוי עם פחות עמודים");
        return;
      }
    }

    setLoading(false);
    const rawHtml = htmlAccumulated.trim();
    if (!rawHtml || !rawHtml.includes("<")) { setError("לא התקבל HTML תקין מהשרת"); return; }
    const finalHtml = sanitizeBookletHtml(rawHtml);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted } = await supabase.from("booklets").insert({
      user_id: user.id,
      child_id: student.id,
      title: `${student.name} — ${goal}`,
      child_name: student.name,
      grade: student.grade,
      world,
      goal,
      level: student.level || "medium",
      html: finalHtml,
    }).select("id, share_token").single();

    setBookletId(inserted?.id ?? null);
    setShareToken(inserted?.share_token ?? null);
    setShowRating(true);
    setHtml(finalHtml);
    onSaved?.();
  }, [canSubmit, student, subject, world, specificGoal, pageCount, onSaved]);

  if (html) {
    return (
      <section className="space-y-4">
        {showRating && bookletId ? (
          <BookletRating
            bookletId={bookletId}
            studentName={student.name}
            onDone={() => setShowRating(false)}
          />
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-4">
              <span className="text-xl">✅</span>
              <span>החוברת נוצרה עבור {student.name}!</span>
            </div>
            <Preview html={html} onReset={onClose} shareToken={shareToken} />
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
          <button onClick={onClose} className="text-ink/30 hover:text-ink text-2xl leading-none mt-0.5">×</button>
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
                onClick={() => setSubject(s)}
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
            onChange={e => setWorld(e.target.value)}
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
            {PAGE_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setPageCount(n)}
                disabled={loading}
                className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${
                  pageCount === n
                    ? "bg-brand text-white border-brand shadow-sm"
                    : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-brand/50"
                }`}
              >
                {n} עמ'
              </button>
            ))}
          </div>
        </div>

        {/* Errors */}
        {rateCountdown > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm text-center">
            ⏳ יש להמתין עוד {rateCountdown} שניות לפני יצירה נוספת
          </div>
        )}
        {error && error !== "quota" && !rateCountdown && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
        )}
        {error === "quota" && (
          <div className="space-y-3">
            <p className="text-ink/60 text-sm text-center">ניצלת את {FREE_LIMIT} החוברות החינמיות</p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-semibold text-center hover:opacity-90 transition-opacity"
            >
              🚀 שדרגי — מ-₪19/חודש
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8 space-y-3">
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
        {!loading && error !== "quota" && (
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
