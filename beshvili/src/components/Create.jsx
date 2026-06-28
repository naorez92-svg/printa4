import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeBookletHtml } from "../lib/sanitize";
import Preview from "./Preview";
import BookletRating from "./BookletRating";
import UpgradeModal from "./UpgradeModal";
import { FREE_LIMIT } from "../hooks/useProfile";
import { useChildren } from "../hooks/useChildren";
import { track } from "../hooks/useEvents";

const WORLDS = [
  "כדורגל", "כדורסל", "גיימינג", "מינקראפט", "פוקימון",
  "חיות", "סוסים", "דינוזאורים", "חלל", "ים וגלים",
  "בישול ואפייה", "מוזיקה", "ריקוד", "אמנות וציור",
  "נינג'ה", "קסמים", "רובוטיקה", "טבע ויערות",
  "ספורט כללי", "מחשבים", "אחר",
];
const EXAM_GRADES   = ["כיתה ג", "כיתה ד", "כיתה ה", "כיתה ו"];
const EXAM_SUBJECTS = [
  { id: "math",    label: "חשבון" },
  { id: "hebrew",  label: "שפה עברית" },
  { id: "science", label: "מדעים" },
  { id: "english", label: "אנגלית" },
  { id: "bible",   label: "תנ\"ך" },
  { id: "history", label: "היסטוריה" },
];
const LEVELS = [["basic", "🌱 בסיסי"], ["medium", "⚡ בינוני"], ["advanced", "🚀 מתקדם"]];
// First 6 are the most broadly-useful (shown by default); the rest appear under the "עוד" toggle.
const TEMPLATES = [
  { icon: "📖", label: "הבנת הנקרא ג-ד",   f: { grade: "כיתה ג",  world: "כדורגל",  goal: "הבנת הנקרא: טקסט ספרותי, שאלות הבנה ואוצר מילים",            level: "basic"    } },
  { icon: "➕", label: "כיתה ב — חיבור",   f: { grade: "כיתה ב",  world: "כדורגל",  goal: "חיבור וחיסור עד 100 ללא מעבר עשרת",                            level: "medium"   } },
  { icon: "✖️", label: "כיתה ג — כפל",     f: { grade: "כיתה ג",  world: "גיימינג", goal: "לוח כפל 6, 7, 8 — שינון ויישום",                               level: "medium"   } },
  { icon: "½",  label: "כיתה ד — שברים",   f: { grade: "כיתה ד",  world: "חלל",     goal: "שברים: חצי, שליש, רבע — זיהוי, חיבור, השוואה",                 level: "medium"   } },
  { icon: "🔄", label: "חזרה לפני בחינה",  f: { grade: "",         world: "גיימינג", goal: "חזרה כללית: ארבע פעולות, שברים, אחוזים, בעיות",                level: "medium"   } },
  { icon: "📋", label: "שיעורי בית שבועיים", f: { grade: "כיתה ג", world: "כדורגל", goal: "שיעורי בית שבועיים: קריאה, כתיבה וחשבון — תרגילים לכל יום", level: "medium" } },
  { icon: "📖", label: "הבנת הנקרא ה-ו",   f: { grade: "כיתה ה",  world: "כדורגל",  goal: "הבנת הנקרא: טקסט ספרותי, שאלות הבנה ואסטרטגיות קריאה",       level: "medium"   } },
  { icon: "🔢", label: "מספרים עשרוניים",   f: { grade: "כיתה ה",  world: "גיימינג", goal: "מספרים עשרוניים: קריאה, כתיבה, השוואה, חיבור וחיסור",          level: "medium"   } },
  { icon: "📖", label: "כיתה א — קריאה",   f: { grade: "כיתה א",  world: "חיות",    goal: "קריאת מילים בניקוד מלא ומשפטים פשוטים",                        level: "basic"    } },
  { icon: "📐", label: "כיתה ה — שטח",     f: { grade: "כיתה ה",  world: "בישול",   goal: "שטח והיקף: ריבוע, מלבן, משולש",                                level: "advanced" } },
  { icon: "%",  label: "כיתה ו — אחוזים",  f: { grade: "כיתה ו",  world: "מוזיקה",  goal: "אחוזים: חישוב, הסקה, בעיות מילוליות",                          level: "advanced" } },
  { icon: "📝", label: "מבחן חצי שנתי",    f: { grade: "",         world: "כללי",    goal: "מבחן חצי שנתי: חשבון, שפה, הבנת הנקרא",                        level: "advanced" } },
  { icon: "🌟", label: "העשרה מתקדמת",     f: { grade: "",         world: "חלל",     goal: "חשיבה מתמטית: פאזלים, לוגיקה, חשיבה מחוץ לקופסה",             level: "advanced" } },
  { icon: "🎯", label: "תרגול ממוקד דיסלקציה", f: { grade: "כיתה ב", world: "חיות", goal: "קריאה וכתיבה: אותיות דומות, מילים בניקוד, הבנת משפט קצר", level: "basic" } },
];
const GOAL_PICKS = [
  { icon: "📖", label: "הבנת הנקרא",       goal: "הבנת הנקרא: טקסט ספרותי, שאלות הבנה ואוצר מילים" },
  { icon: "🔢", label: "מספרים עשרוניים",  goal: "מספרים עשרוניים: קריאה, כתיבה, השוואה, חיבור וחיסור" },
  { icon: "½",  label: "שברים",            goal: "שברים: חיבור, חיסור, השוואה ומספר מעורב" },
  { icon: "✖️", label: "כפל וחילוק",       goal: "לוח כפל וחילוק: שינון, יישום ובעיות מילוליות" },
  { icon: "%",  label: "אחוזים",           goal: "אחוזים: מציאת האחוז, מציאת הכמות, בעיות מילוליות" },
  { icon: "📝", label: "כתיבה יוצרת",      goal: "כתיבה יוצרת: בניית סיפור, תיאור דמויות וסצנה" },
  { icon: "📐", label: "שטח והיקף",        goal: "שטח והיקף: ריבוע, מלבן, משולש" },
  { icon: "🔤", label: "דקדוק עברי",       goal: "דקדוק עברי: פועל, שם עצם, שם תואר, זמנים" },
  { icon: "🔡", label: "קריאה בניקוד",     goal: "קריאה בניקוד: פענוח, הבנת המילה, קריאת משפטים" },
  { icon: "🔢", label: "חיבור וחיסור",     goal: "חיבור וחיסור: אלגוריתמים, מעבר עשרת, בעיות" },
];
const EMPTY = { childName: "", grade: "", world: "כדורגל", goal: "", level: "medium" };
const PAGE_OPTIONS = [3, 5, 7, 10];
const LOADING_MSGS = [
  "מכינה את החוברת... ✍️",
  "בונה תרגילים מגוונים...",
  "כותבת שאלות וסיפורים...",
  "מעצבת עמודים יפים...",
  "מוסיפה צבעים ואיורים...",
  "מדייקת לפי רמת הילד...",
  "עורכת ובודקת הכל...",
  "כמעט מוכן! עוד רגע...",
];

export default function Create({ onSaved, remaining, isPro, active = true, bookletCount = 0, onUpgrade }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const openUpgrade = onUpgrade ?? (() => setShowUpgrade(true));
  const [mode, setMode]           = useState(() => {
    try { return localStorage.getItem("beshvili_mode") || "quick"; } catch { return "quick"; }
  });
  const [f, setF]                 = useState(EMPTY);
  const [freeText, setFreeText]   = useState("");
  const [pageCount, setPageCount] = useState(5);
  const [withAnswerKey, setWithAnswerKey] = useState(false);
  const [examGrade,   setExamGrade]   = useState(EXAM_GRADES[2]);  // כיתה ה default
  const [examSubject, setExamSubject] = useState("");
  const [examTopic,   setExamTopic]   = useState("");
  const [noEmojis,    setNoEmojis]    = useState(true);             // formal by default
  const [customWorld, setCustomWorld] = useState("");
  const [loading, setLoading]     = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [html, setHtml]           = useState(null);
  const [bookletId, setBookletId] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [bookletTitle, setBookletTitle] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);   // generated OK but cloud-save failed
  const [error, setError]         = useState(null); // null | "quota" | "quota_monthly" | "rate:{wait}" | "generic:{msg}"
  const [rateCountdown, setRateCountdown] = useState(null);
  const [childSaved, setChildSaved] = useState(false);
  const { children: savedChildren, loaded: childrenLoaded, save: saveChild } = useChildren();
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [recentTmpl, setRecentTmpl] = useState(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);  // collapse 14→6 by default
  const firstTimer = bookletCount === 0;
  const [showMoreModes, setShowMoreModes] = useState(false);        // first-timers: hide free/exam behind disclosure
  const creatingRef   = useRef(false);   // prevent double-submit
  const streamAbortRef = useRef(null);   // cancel in-flight SSE on unmount

  // Rotate loading messages every 3.5 s while generating; tick elapsed seconds
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); setStreamChars(0); setLoadingElapsed(0); return; }
    const msgId = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 3500);
    const secId = setInterval(() => setLoadingElapsed(s => s + 1), 1000);
    return () => { clearInterval(msgId); clearInterval(secId); };
  }, [loading]);

  // Abort any in-flight SSE stream on unmount
  useEffect(() => () => streamAbortRef.current?.abort(), []);

  // Fire once when the free-quota paywall screen renders
  useEffect(() => {
    if (error === "quota") track("quota_screen_shown", { bookletCount });
  }, [error, bookletCount]);

  // Start countdown when rate-limited
  useEffect(() => {
    const match = error?.match(/^rate:(\d+)$/);
    setRateCountdown(match ? parseInt(match[1]) : null);
  }, [error]);

  // Tick countdown and auto-clear at 0
  useEffect(() => {
    if (!rateCountdown || rateCountdown <= 0) {
      if (rateCountdown === 0) setError(null);
      return;
    }
    const t = setTimeout(() => setRateCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [rateCountdown]);

  const canSubmit = !loading && (
    mode === "free"  ? freeText.trim().length > 5 :
    mode === "quick" ? f.goal.trim().length > 2 :
    mode === "exam"  ? (examSubject.trim().length > 0 && examTopic.trim().length > 1) :
    !!(f.childName.trim() && f.goal.trim())
  );

  const create = useCallback(async () => {
    if (!canSubmit || creatingRef.current) return;
    creatingRef.current = true;
    const startedAt = Date.now();   // true generation duration (not the stale loadingElapsed closure)
    setLoading(true);
    setHtml(null);
    setError(null);
    const effectiveWorld = f.world === "אחר" ? customWorld.trim() || "נושא חופשי" : f.world;
    const trackError = (type, extra = {}) => track("booklet_error", { type, mode, pageCount, ...extra });
    track("booklet_started", { mode, goal: mode === "exam" ? examTopic : f.goal, grade: mode === "exam" ? examGrade : f.grade, world: mode === "exam" ? null : effectiveWorld, pageCount, withAnswerKey, photo: !!photoUrl });

    // Ask for notification permission so we can alert when done (non-blocking)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const quickText = `דף תרגיל מהיר${f.childName ? ` עבור ${f.childName.trim()}` : ""}${f.grade ? `, כיתה ${f.grade}` : ""}. נושא: ${f.goal.trim()}${effectiveWorld ? `, עולם תוכן: ${effectiveWorld}` : ""}. צור עמוד A4 אחד עם 8–12 תרגילים מגוונים ומהנים. ללא שער ורפלקציה. קוד HTML גולמי בלבד.`;

    const body = mode === "free"
      ? { freeText: freeText.trim(), pageCount, withAnswerKey }
      : mode === "quick"
      ? { freeText: quickText, pageCount: 1, withAnswerKey: false }
      : mode === "exam"
      ? { examMode: true, examGrade, examSubject, examTopic, noEmojis, pageCount, withAnswerKey }
      : { ...f, world: effectiveWorld, pageCount, withAnswerKey, ...(photoUrl ? { childPhotoUrl: photoUrl } : {}) };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      creatingRef.current = false;
      trackError("no_session");
      setError("generic:אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }

    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;

    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/generate-booklet`;
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
      if (ctrl.signal.aborted) return; // unmounted — don't show error
      trackError("network");
      setError(`generic:שגיאת רשת — ${String(e)}`);
      return;
    }

    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => "");
      let errData = {};
      try { errData = JSON.parse(rawBody); } catch {}
      const code = errData?.error;
      console.error("[generate-booklet] HTTP", resp.status, "body:", rawBody.substring(0, 300));
      setLoading(false);
      creatingRef.current = false;
      if (code === "quota_exceeded") {
        const monthly = errData?.period === "monthly";
        trackError(monthly ? "quota_monthly" : "quota");
        setError(monthly ? "quota_monthly" : "quota");
        return;
      }
      if (code === "rate_limited") { const wait = errData?.wait ?? 60; trackError("rate_limited", { wait }); setError(`rate:${wait}`); return; }
      if (code === "ai_overloaded") { trackError("ai_overloaded"); setError("generic:השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"); return; }
      if (code === "ai_timeout")    { trackError("ai_timeout"); setError("generic:הייצור לקח יותר מדי זמן — נסי עם פחות עמודים"); return; }
      if (resp.status === 401)      { trackError("session_expired"); setError("generic:הסשן פג תוקף — רענן את הדף וכנסי מחדש"); return; }
      trackError("server_error", { status: resp.status });
      const detail = code || (rawBody.length < 80 ? rawBody : rawBody.substring(0, 60) + "…");
      setError(`generic:שגיאת שרת ${resp.status}${detail ? ` — ${detail}` : ""}`);
      return;
    }

    // Screen Wake Lock — prevents Android battery optimizer from killing the connection
    let wakeLock = null;
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch {}

    // Read SSE stream — Anthropic sends content_block_delta events with text chunks
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let htmlAccumulated = "";
    let updateTimer = 0;
    let streamAborted = false;
    let streamHadError = false;
    let streamErrorMsg = null;
    let streamErrType = null;

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
              // Throttle React state updates to ~10fps
              const now = Date.now();
              if (now - updateTimer > 100) {
                setStreamChars(htmlAccumulated.length);
                updateTimer = now;
              }
            } else if (ev.type === "error") {
              streamHadError = true;
              const errType = ev.error?.type ?? "unknown";
              streamErrType = errType;
              streamErrorMsg = errType === "overloaded_error"
                ? "generic:השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"
                : `generic:שגיאת AI — ${errType}`;
            }
          } catch {}
          if (streamHadError) break;
        }
        if (streamHadError) break;
      }
    } catch (streamErr) {
      wakeLock?.release().catch(() => {});
      // Unmounted / navigated away mid-stream: don't setState or save a booklet
      // the user abandoned.
      if (ctrl.signal.aborted) { creatingRef.current = false; return; }
      // Save partial booklet if we got substantial HTML (e.g. connection dropped mid-stream)
      const partial = htmlAccumulated.trim();
      if (partial.length > 8000 && (partial.includes("<!DOCTYPE") || partial.includes("<html"))) {
        if (!partial.includes("</html>")) htmlAccumulated = partial + "\n</body></html>";
        streamAborted = true;
        // Fall through to save the partial booklet below
      } else {
        setLoading(false);
        creatingRef.current = false;
        trackError("stream_dropped");
        setError("generic:החיבור נקטע — נסה שנית, רצוי עם פחות עמודים");
        return;
      }
    }

    wakeLock?.release().catch(() => {});
    setLoading(false);
    creatingRef.current = false;

    if (streamHadError) { trackError("stream_error", { errType: streamErrType }); setError(streamErrorMsg); return; }

    // Strip all scripts + event-handler attributes from AI-generated HTML,
    // then restore the Tailwind CDN script (see src/lib/sanitize.js).
    const generatedHtml = sanitizeBookletHtml(htmlAccumulated.trim());
    if (!generatedHtml || !generatedHtml.includes("<")) { trackError("empty_html"); setError("generic:לא התקבל HTML תקין מהשרת"); return; }

    const baseTitle = mode === "free"
      ? freeText.trim().substring(0, 60) + (freeText.length > 60 ? "…" : "")
      : mode === "quick"
      ? `⚡ ${f.goal.trim().substring(0, 50)}`
      : mode === "exam"
      ? `📝 מבחן ${examSubject}${examGrade ? ` — ${examGrade}` : ""}${examTopic ? `: ${examTopic.substring(0, 40)}` : ""}`
      : `${f.childName} — ${f.goal}`;
    const title = streamAborted ? `${baseTitle} (חלקי)` : baseTitle;

    const { data: inserted, error: insertErr } = await supabase.from("booklets").insert({
      user_id: session.user.id, title,
      child_name: f.childName || null, grade: f.grade || null,
      world: mode === "exam" ? null : (effectiveWorld || null),
      goal: mode === "free" ? freeText.trim().substring(0, 200) : mode === "exam" ? examTopic : f.goal,
      level: f.level, html: generatedHtml,
    }).select("id, share_token").single();
    if (insertErr) {
      // A save failure must NOT discard a ~90s generation — show the booklet so the
      // user can still print / download it; only the cloud copy is missing.
      trackError("db_insert_failed", { message: insertErr.message });
      track("booklet_completed", { booklet_id: null, pages: pageCount, mode, durationSec: Math.round((Date.now() - startedAt) / 1000), chars: htmlAccumulated.length, save_failed: true });
      setSaveWarning(true);
      setBookletTitle(title);
      setHtml(generatedHtml);
      onSaved?.(); // refresh quota count even though the DB row wasn't saved
      return;
    }

    setBookletId(inserted?.id ?? null);
    setShareToken(inserted?.share_token ?? null);
    setBookletTitle(title);
    setShowRating(true);
    setHtml(generatedHtml);
    track("booklet_completed", { booklet_id: inserted?.id, pages: pageCount, mode, durationSec: Math.round((Date.now() - startedAt) / 1000), chars: htmlAccumulated.length, partial: streamAborted, withAnswerKey });
    onSaved?.();

    // Notify user if they switched away during generation
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try {
        new Notification("החוברת מוכנה! 🎉", {
          body: title.substring(0, 80),
          icon: "/icon.svg",
          tag: "booklet-ready",
        });
      } catch {}
    }
  }, [canSubmit, mode, freeText, f, pageCount, withAnswerKey, onSaved, photoUrl, examGrade, examSubject, examTopic, noEmojis, customWorld]);

  useEffect(() => {
    if (!active) return;
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") create(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [create, active]);

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    track("photo_upload_started", { size_bytes: file.size });
    if (file.size > 5 * 1024 * 1024) { track("photo_upload_failed", { reason: "too_large" }); alert("תמונה גדולה מדי — מקסימום 5MB"); return; }
    setPhotoUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhotoUploading(false); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("child-photos").upload(path, file, { upsert: true });
    if (upErr) {
      setPhotoUploading(false);
      track("photo_upload_failed", { reason: "upload_error" });
      alert("העלאת התמונה נכשלה — ודאי שהקובץ הוא תמונה תקינה (JPG/PNG) עד 5MB");
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("child-photos").getPublicUrl(path);
    track("photo_upload_succeeded", {});
    setPhotoUrl(publicUrl);
    setPhotoUploading(false);
    e.target.value = "";
  }, []);

  const reset = () => { setHtml(null); setF(EMPTY); setFreeText(""); setError(null); setBookletId(null); setShareToken(null); setBookletTitle(null); setShowRating(false); setChildSaved(false); setPhotoUrl(null); setSaveWarning(false); };
  const set   = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const applyTmpl = (tmpl) => {
    track("template_chip_clicked", { label: tmpl.label, grade: tmpl.f.grade, world: tmpl.f.world, level: tmpl.f.level });
    setF((p) => ({ ...p, ...tmpl.f }));
    setMode("form");
    setRecentTmpl(tmpl.label);
    setTimeout(() => setRecentTmpl(null), 1500);
    setTimeout(() => document.getElementById("inp-goal")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
  };

  // ── Pro monthly quota exceeded ────────────────────────────────────────────
  if (error === "quota_monthly") {
    return (
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-ink/5 text-center space-y-5">
        <div className="text-5xl">📅</div>
        <div>
          <h2 className="text-xl font-bold text-ink mb-1">הגעת למכסה החודשית!</h2>
          <p className="text-ink/60 text-sm">המכסה מתחדשת בתחילת כל חודש</p>
          <p className="text-ink/40 text-xs mt-1">צריך יותר? שלחי הודעה ונרחיב את המכסה</p>
        </div>
        <a
          href={`https://wa.me/972509139137?text=${encodeURIComponent("שלום! הגעתי ל-20 חוברות החודש — אפשר להרחיב?")}`}
          target="_blank" rel="noopener noreferrer"
          onClick={() => track("quota_monthly_whatsapp_clicked", {})}
          className="block w-full bg-[#25D366] text-white rounded-xl p-3.5 font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          💬 שלחי הודעה
        </a>
        <button onClick={() => setError(null)} className="text-xs text-ink/30 hover:text-ink/50 underline">
          חזרה
        </button>
      </section>
    );
  }

  // ── Quota exceeded screen ──────────────────────────────────────────────────
  if (error === "quota") {
    return (
      <>
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} bookletCount={bookletCount} source="create_quota" />}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-ink/5 text-center space-y-5">
          <div className="text-5xl">🔒</div>
          <div>
            <h2 className="text-xl font-bold text-ink mb-1">ניצלת את {FREE_LIMIT} החוברות החינמיות!</h2>
            <p className="text-ink/60 text-sm">שדרגי וקבלי עוד חוברות — מ-19 ₪/חודש בלבד</p>
          </div>

          {/* Value hook */}
          <div className="bg-magic/8 border border-magic/20 rounded-xl px-3 py-2 text-right text-xs text-magic">
            20 חוברות = 20 שעות הכנה שנחסכות 💡 · מורה פרטית = ROI של <strong>40x</strong>
          </div>

          <div className="grid grid-cols-2 gap-3 text-right">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 space-y-1">
              <p className="font-bold text-blue-700 text-sm">🌟 הורה</p>
              <p className="text-2xl font-bold text-blue-700">₪19<span className="text-xs font-normal text-blue-400">/חודש</span></p>
              <p className="text-xs text-blue-500">5 חוברות · 10 עמודים</p>
              <p className="text-xs font-semibold text-blue-600">≈ ₪4 לחוברת</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 space-y-1">
              <p className="font-bold text-magic text-sm">🚀 מורה</p>
              <p className="text-2xl font-bold text-magic">₪59<span className="text-xs font-normal text-magic/50">/חודש</span></p>
              <p className="text-xs text-magic/60">20 חוברות · 20 עמודים</p>
              <p className="text-xs font-semibold text-magic">≈ ₪3 לחוברת</p>
            </div>
          </div>

          <button
            onClick={() => { track("upgrade_intent_clicked", { source: "create_quota_screen" }); openUpgrade(); }}
            className="block w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            🚀 שדרגי עכשיו
          </button>
          <button onClick={() => setError(null)} className="text-xs text-ink/30 hover:text-ink/50 underline">
            חזרה (למי שכבר שדרגה)
          </button>
        </section>
      </>
    );
  }

  // ── Generated ──────────────────────────────────────────────────────────────
  if (html) {
    const timeSaved = mode === "quick" ? 15 : mode === "exam" ? pageCount * 6 : pageCount * 8;
    // Total lifetime savings (45 min avg × total booklets ever created, including this one)
    const totalSavedMin = (bookletCount) * 45; // bookletCount already includes the new one after onSaved()
    const totalSavedStr = totalSavedMin >= 120
      ? `${(totalSavedMin / 60).toFixed(1).replace(".0", "")} שעות`
      : `${totalSavedMin} דק'`;

    return (
      <section className="space-y-4">
        {/* Save-warning banner — cloud save failed but booklet was generated */}
        {saveWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-right">
            <p className="font-bold text-amber-800 text-sm">⚠️ החוברת נוצרה אבל לא נשמרה בענן</p>
            <p className="text-xs text-amber-700 mt-1">הדפיסי אותה עכשיו כדי לא לאבד אותה. היסטוריה לא תציג חוברת זו.</p>
          </div>
        )}

        {/* Success banner */}
        <div className="bg-gradient-to-l from-grow/20 to-emerald-50 border border-grow/25 rounded-2xl overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-11 h-11 bg-grow/15 rounded-full flex items-center justify-center text-2xl">
                🎉
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-ink text-base">החוברת מוכנה!</p>
                <p className="text-xs text-ink/55 mt-0.5">
                  {saveWarning ? "מוכנה להדפסה ·" : "נשמרה בענן ·"}&nbsp;
                  <span className="text-grow font-semibold">⏱ חסכת ~{timeSaved} דקות הכנה</span>
                </p>
              </div>
            </div>

            {/* ROI stats */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                <p className="text-[10px] text-ink/40 mb-0.5">זמן שחסכת עכשיו</p>
                <p className="font-bold text-grow text-xl">⏱ {timeSaved} דק'</p>
              </div>
              <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
                <p className="text-[10px] text-ink/40 mb-0.5">
                  {bookletCount > 1 ? "סה\"כ חסכת" : "שווי מול מורה פרטית"}
                </p>
                <p className="font-bold text-brand text-xl">
                  {bookletCount > 1 ? totalSavedStr : `₪${Math.round(timeSaved / 60 * 120)}`}
                </p>
              </div>
            </div>
          </div>

          {/* Quota bar — free users only */}
          {!isPro && (
            <div className={`border-t px-5 py-3 flex items-center justify-between gap-3 ${
              remaining === 0 ? "bg-red-50 border-red-200"
              : remaining === 1 ? "bg-amber-50 border-amber-200"
              : "bg-white/40 border-grow/15"
            }`}>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${remaining === 0 ? "text-red-700" : remaining === 1 ? "text-amber-700" : "text-ink/50"}`}>
                  {remaining === 0
                    ? "🚫 נגמרה המכסה החינמית"
                    : remaining === 1
                    ? "⚠️ נשארה חוברת חינמית אחת בלבד!"
                    : `${remaining} חוברות חינמיות נותרו`}
                </p>
                <div className="flex gap-1 mt-1.5">
                  {[...Array(FREE_LIMIT)].map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full flex-1 transition-all ${
                      i < bookletCount
                        ? remaining === 0 ? "bg-red-400" : remaining === 1 ? "bg-amber-400" : "bg-brand"
                        : "bg-ink/10"
                    }`} />
                  ))}
                </div>
              </div>
              <button
                onClick={() => { track("upgrade_intent_clicked", { source: "post_success_quota_bar", remaining }); openUpgrade(); }}
                className={`flex-shrink-0 text-xs rounded-xl px-4 py-2 font-semibold transition-opacity hover:opacity-90 ${
                  remaining === 0
                    ? "bg-red-500 text-white shadow-sm"
                    : remaining === 1
                    ? "bg-gradient-to-l from-brand to-magic text-white shadow-sm"
                    : "border border-magic/40 text-magic"
                }`}
              >
                {remaining === 0 ? "שדרגי עכשיו 🚀" : remaining === 1 ? "שדרגי ✨" : "ראי תוכניות"}
              </button>
            </div>
          )}
        </div>

        {/* Booklet preview — shown immediately, always first */}
        <Preview html={html} onReset={reset} shareToken={shareToken} title={bookletTitle} active={active} context="create" bookletId={bookletId} />

        {/* Rating widget — shown below the booklet, optional */}
        {showRating && bookletId && (
          <BookletRating
            bookletId={bookletId}
            studentName={f.childName || null}
            onDone={() => setShowRating(false)}
          />
        )}

        {/* Save child profile prompt */}
        {mode === "form" && f.childName.trim() && childrenLoaded && !childSaved && !savedChildren.some(c => c.name.toLowerCase() === f.childName.trim().toLowerCase()) && (
          <button
            onClick={async () => {
              const saved = await saveChild({ name: f.childName, grade: f.grade, world: f.world, level: f.level, photo_url: photoUrl });
              if (saved) { track("child_profile_saved", { grade: f.grade, world: f.world, level: f.level, has_photo: !!photoUrl }); setChildSaved(true); }
            }}
            className="w-full flex items-center justify-center gap-2 border border-grow/40 text-grow rounded-xl p-3 text-sm font-semibold hover:bg-grow/5 transition-colors"
          >
            <span>💾</span>
            <span>שמור את {f.childName.trim()} לפעם הבאה</span>
          </button>
        )}
        {childSaved && (
          <p className="text-center text-xs text-grow py-1">✓ {f.childName.trim()} נשמר/ה לפרופילים שלך</p>
        )}
      </section>
    );
  }

  return (
    <>
    {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} bookletCount={bookletCount} source="create_form" />}
    <section className="bg-white rounded-2xl shadow-sm border border-ink/5 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-magic/10 to-brand/10 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">✨ חוברת חדשה</h2>
          {!isPro && remaining === 0 && (
            <span className="text-xs text-red-500 font-medium">נגמרה המכסה החינמית</span>
          )}
        </div>
        {(() => {
          const switchMode = (m) => { if (m !== mode) track("create_mode_switched", { from: mode, to: m }); setMode(m); try { localStorage.setItem("beshvili_mode", m); } catch {} };
          const primaryModes  = [["quick", "⚡ דף מהיר"], ["form", "📋 טופס"]];
          const advancedModes = [["free", "✍️ חופשי"], ["exam", "📝 מבחן"]];
          // First-timers (bookletCount === 0) see only the two primary modes up front;
          // free/exam sit behind an "עוד אפשרויות" disclosure to cut first-impression overload.
          const showAdvanced = !firstTimer || showMoreModes || mode === "free" || mode === "exam";
          const visibleModes = firstTimer && !showAdvanced ? primaryModes : [...primaryModes, ...advancedModes];
          const tabBtn = ([m, label]) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === m ? "bg-white shadow text-ink" : "text-ink/50 hover:text-ink"}`}>
              {label}
            </button>
          );
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1 bg-white/70 rounded-xl p-1 w-fit flex-wrap">
                {visibleModes.map(tabBtn)}
              </div>
              {firstTimer && !showAdvanced && (
                <button type="button" onClick={() => setShowMoreModes(true)}
                  className="text-xs text-ink/40 hover:text-magic transition-colors underline underline-offset-2">
                  עוד אפשרויות ▾
                </button>
              )}
            </div>
          );
        })()}
        <p className="text-xs text-ink/40 mt-2">
          {mode === "quick" && "⚡ דף תרגיל אחד, מוכן ב-30 שניות — מושלם לשיעורי בית"}
          {mode === "form"  && "📋 חוברת מלאה עם שער אישי, תרגילים ורפלקציה — מותאמת לילד"}
          {mode === "free"  && "✍️ כתוב בחופשיות מה שרוצה — ה-AI יייצר לפי הוראותיך"}
          {mode === "exam"  && "📝 מבחן רשמי לכיתות ג-ו — מוכן להגשה לבית ספר ללא עיצוב מוגזם"}
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Templates — show 6 by default, rest behind "עוד" toggle to reduce overload */}
        <div>
          <p className="text-xs text-ink/50 mb-2 font-semibold">👇 בחר נושא להתחיל — או מלא בעצמך למטה</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(showAllTemplates ? TEMPLATES : TEMPLATES.slice(0, 6)).map((t) => (
              <button key={t.label} onClick={() => applyTmpl(t)}
                className={`flex-shrink-0 border rounded-full px-3 py-1 text-xs transition-colors whitespace-nowrap ${recentTmpl === t.label ? "border-magic bg-magic/10 text-magic font-semibold" : "border-ink/15 text-ink/70 hover:border-magic hover:text-magic"}`}>
                {t.icon} {t.label}
              </button>
            ))}
            {TEMPLATES.length > 6 && (
              <button type="button" onClick={() => setShowAllTemplates(v => !v)}
                className="flex-shrink-0 text-xs text-ink/40 hover:text-magic transition-colors whitespace-nowrap px-2 py-1 underline underline-offset-2">
                {showAllTemplates ? "פחות ▴" : "עוד ▾"}
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-ink/5" />

        {/* Form mode */}
        {mode === "form" && (
          <div className="space-y-3">
            {/* Saved children selector */}
            {childrenLoaded && savedChildren.length > 0 && (
              <div>
                <p className="text-xs text-ink/40 mb-1.5 font-medium">תלמידים שלי</p>
                <div className="flex gap-2 flex-wrap">
                  {savedChildren.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setF(p => ({
                          ...p,
                          childName: c.name,
                          grade: c.grade || p.grade,
                          world: c.worlds?.[0] || p.world,
                          level: c.level || p.level,
                        }));
                        setPhotoUrl(c.photo_url || null);
                      }}
                      className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-40 ${f.childName === c.name ? "border-magic text-magic bg-magic/5" : "border-ink/15 text-ink/70 hover:border-magic hover:text-magic bg-canvas/50"}`}
                    >
                      <span>👤</span>
                      <span>{c.name}</span>
                      {c.grade && <span className="text-ink/30">· {c.grade}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input id="inp-name" className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50" placeholder="שם הילד/ה *" value={f.childName} onChange={set("childName")} disabled={loading} />
              <input className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50" placeholder="כיתה" value={f.grade} onChange={set("grade")} disabled={loading} />
            </div>

            {/* Child photo upload — progressive disclosure */}
            <input type="file" ref={photoInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            {(!showPhoto && !photoUrl) ? (
              <button
                type="button"
                onClick={() => setShowPhoto(true)}
                className="text-xs text-ink/35 hover:text-magic transition-colors text-right w-full py-1"
              >
                📷 הוסף תמונה לשער (אופציונלי) +
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="העלה תמונת פרופיל"
                  onClick={() => !loading && !photoUploading && photoInputRef.current?.click()}
                  disabled={loading || photoUploading}
                  className={`relative flex-shrink-0 w-12 h-12 rounded-full border-2 border-dashed overflow-hidden flex items-center justify-center transition-colors ${photoUrl ? "border-grow" : "border-magic/30 hover:border-magic/60"}`}
                >
                  {photoUploading ? (
                    <div className="w-4 h-4 border-2 border-magic border-t-transparent rounded-full animate-spin" />
                  ) : photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">📷</span>
                  )}
                </button>
                <div className="flex-1 text-right">
                  {photoUploading ? (
                    <p className="text-xs text-ink/50">טוען תמונה...</p>
                  ) : photoUrl ? (
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setPhotoUrl(null)} className="text-xs text-red-400 hover:text-red-600 transition-colors" disabled={loading}>הסר תמונה ×</button>
                      <p className="text-xs text-grow font-medium">תמונה תופיע בשער ✓</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-ink/50">תמונה לשער <span className="text-ink/30">(אופציונלי)</span></p>
                      <p className="text-xs text-ink/30">תופיע כאיור עגול בשער החוברת</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-ink/40 mb-1.5 font-medium">מה הילד/ה אוהב? (עולם התוכן)</p>
              <select className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-canvas/50 text-right" value={f.world} onChange={set("world")} disabled={loading}>
                {WORLDS.map((w) => <option key={w}>{w}</option>)}
              </select>
              {f.world === "אחר" && (
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 mt-2 outline-none focus:border-magic text-right bg-canvas/50"
                  placeholder="למשל: בלט, כדורעף, כישוף, ספרים... (כתוב כאן את הנושא)"
                  value={customWorld}
                  onChange={(e) => setCustomWorld(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              )}
            </div>
            <div>
              <textarea id="inp-goal" className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50" placeholder="מה לתרגל? * — למשל: חיבור וחיסור עד 100, הבנת הנקרא..." rows={2} value={f.goal} onChange={set("goal")} disabled={loading} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {GOAL_PICKS.map(({ icon, label, goal }) => (
                  <button key={label} type="button" onClick={() => setF(p => ({ ...p, goal }))} disabled={loading}
                    className={`text-xs border rounded-full px-2.5 py-1 transition-colors disabled:opacity-30 ${f.goal === goal ? "border-magic text-magic bg-magic/5" : "border-ink/15 text-ink/50 hover:border-magic hover:text-magic"}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {LEVELS.map(([v, t]) => (
                <button key={v} onClick={() => setF((p) => ({ ...p, level: v }))} disabled={loading}
                  className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${f.level === v ? "bg-magic text-white border-magic shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-magic/50"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick mode */}
        {mode === "quick" && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
              <span>⚡</span>
              <span>דף תרגיל אחד · ~30 שניות · מושלם לשיעורי בית מהירים</span>
            </div>
            <input
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
              placeholder="שם הילד/ה (אופציונלי)"
              value={f.childName}
              onChange={set("childName")}
              disabled={loading}
            />
            <input
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
              placeholder="כיתה (אופציונלי) — כיתה ב, כיתה ד..."
              value={f.grade}
              onChange={set("grade")}
              disabled={loading}
            />
            <div>
              <input
                className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right bg-canvas/50"
                placeholder="מה לתרגל? * — למשל: חיבור וחיסור עד 100, קריאה בניקוד..."
                value={f.goal}
                onChange={set("goal")}
                disabled={loading}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {GOAL_PICKS.map(({ icon, label, goal }) => (
                  <button key={label} type="button" onClick={() => setF(p => ({ ...p, goal }))} disabled={loading}
                    className={`text-xs border rounded-full px-2.5 py-1 transition-colors disabled:opacity-30 ${f.goal === goal ? "border-magic text-magic bg-magic/5" : "border-ink/15 text-ink/50 hover:border-magic hover:text-magic"}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            <select
              className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic bg-canvas/50 text-right"
              value={f.world}
              onChange={set("world")}
              disabled={loading}
            >
              {WORLDS.map((w) => <option key={w}>{w}</option>)}
            </select>
            {f.world === "אחר" && (
              <input
                className="w-full border border-ink/20 rounded-xl p-3 mt-2 outline-none focus:border-magic text-right bg-canvas/50"
                placeholder="למשל: בלט, כדורעף, כישוף, ספרים... (כתוב כאן את הנושא)"
                value={customWorld}
                onChange={(e) => setCustomWorld(e.target.value)}
                disabled={loading}
                autoFocus
              />
            )}
          </div>
        )}

        {/* Free text mode */}
        {mode === "free" && (
          <textarea
            className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50 leading-relaxed"
            placeholder={"דוגמאות:\n• \"דניאל, כיתה ד, אוהב כדורסל — תרגול שברים\"\n• \"מבחן חצי שנתי לכיתה ה' בחשבון ובשפה\"\n• \"חוברת חזרה לפני בחינה — ארבע פעולות\""}
            rows={6} value={freeText} onChange={(e) => setFreeText(e.target.value)} disabled={loading} autoFocus
          />
        )}

        {/* Exam mode */}
        {mode === "exam" && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
              <span>📋</span>
              <span>מבחן רשמי מוכן להגשה · עיצוב קלאסי · שחור-לבן</span>
            </div>

            {/* Grade */}
            <div>
              <p className="text-xs text-ink/40 mb-1.5 font-medium">כיתה</p>
              <div className="flex gap-2">
                {EXAM_GRADES.map(g => (
                  <button key={g} type="button" onClick={() => setExamGrade(g)} disabled={loading}
                    className={`flex-1 rounded-xl p-2 text-sm font-medium border transition-colors ${examGrade === g ? "bg-ink text-white border-ink shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-ink/40"}`}>
                    {g.replace("כיתה ", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <p className="text-xs text-ink/40 mb-1.5 font-medium">מקצוע <span className="text-red-400">*</span></p>
              <div className="flex flex-wrap gap-2">
                {EXAM_SUBJECTS.map(s => (
                  <button key={s.id} type="button" onClick={() => setExamSubject(s.label)} disabled={loading}
                    className={`rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${examSubject === s.label ? "bg-ink text-white border-ink shadow-sm" : "bg-canvas/50 border-ink/15 text-ink/60 hover:border-ink/40"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div>
              <p className="text-xs text-ink/40 mb-1.5 font-medium">נושא המבחן <span className="text-red-400">*</span></p>
              <textarea
                className="w-full border border-ink/20 rounded-xl p-3 outline-none focus:border-magic text-right resize-none bg-canvas/50"
                placeholder="למשל: כפל וחילוק עד 100 · שברים פשוטים · הבנת הנקרא — טקסט עיוני"
                rows={2}
                value={examTopic}
                onChange={e => setExamTopic(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            {/* No-emoji toggle */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-ink">ללא אימוג'ים</span>
                <span className="text-xs text-ink/40 mr-2">מסמך רשמי לבית ספר</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={noEmojis}
                aria-label="ללא אימוג'ים"
                onClick={() => !loading && setNoEmojis(v => !v)}
                disabled={loading}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${noEmojis ? "bg-ink" : "bg-ink/20"}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${noEmojis ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-ink/5" />

        {/* Page count selector — hidden in quick mode */}
        {mode !== "quick" && <div>
          <p className="text-xs text-ink/40 mb-2 font-medium">כמות עמודים</p>
          <div className="flex gap-2">
            {PAGE_OPTIONS.map((n) => {
              const isLocked = !isPro && n > 5;
              return (
                <button
                  key={n}
                  onClick={() => { if (isLocked) { track("page_count_locked_clicked", { pages: n, mode, bookletCount }); openUpgrade(); return; } track("page_count_selected", { pages: n, mode }); setPageCount(n); }}
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
          {!isPro && <p className="text-[10px] text-ink/30 mt-1 text-center">7 ו-10 עמודים זמינים בתוכנית בתשלום</p>}
        </div>}

        {/* Answer key toggle — hidden in quick mode */}
        {mode !== "quick" && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-medium text-ink">מפתח תשובות</span>
              <span className="text-xs text-ink/40 mr-2">דף תשובות בסוף החוברת</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={withAnswerKey}
              aria-label="מפתח תשובות"
              onClick={() => !loading && setWithAnswerKey(v => !v)}
              disabled={loading}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magic ${withAnswerKey ? "bg-magic" : "bg-ink/20"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${withAnswerKey ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
        )}

        {/* Rate limit countdown */}
        {rateCountdown > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm text-center">
            ⏳ יש להמתין עוד {rateCountdown} שניות לפני יצירה נוספת
          </div>
        )}

        {/* Generic error */}
        {error?.startsWith("generic:") && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            {error.replace("generic:", "")}
          </div>
        )}

        {/* Submit / loading */}
        {loading ? (
          <div className="py-10 space-y-5">
            {/* Animated creation orb */}
            <div className="flex justify-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-magic/20 border-t-magic animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-brand/20 border-b-brand animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">✨</div>
              </div>
            </div>

            {/* Context-aware title */}
            <div className="text-center">
              <p className="font-display font-bold text-ink text-lg">
                {mode === "exam"
                  ? `📝 מכין מבחן ${examSubject}${examGrade ? ` — ${examGrade}` : ""}`
                  : f.childName
                  ? `✨ יוצרת עבור ${f.childName}`
                  : "✨ יוצרת חוברת..."}
              </p>
              <p className="text-ink/55 text-sm mt-1">{LOADING_MSGS[loadingMsgIdx]}</p>
            </div>

            {/* Progress bar + stats */}
            <div className="space-y-1.5">
              <div className="w-full bg-canvas rounded-full h-2.5 overflow-hidden">
                {streamChars > 0
                  ? <div className="h-full bg-gradient-to-l from-brand via-magic to-grow rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(97, (streamChars / (pageCount * 3200)) * 100)}%` }} />
                  : <div className="h-full bg-gradient-to-l from-brand via-magic to-grow rounded-full animate-shimmer" />
                }
              </div>
              <div className="flex justify-between text-xs text-ink/35">
                <span>{streamChars > 0 ? `${streamChars.toLocaleString("he-IL")} תווים` : (mode === "quick" ? "עמוד A4 אחד" : `${pageCount} עמודי A4`)}</span>
                <span>⏱ {loadingElapsed}s</span>
              </div>
            </div>

            {/* Tip shown while waiting */}
            <div className="bg-magic/5 border border-magic/15 rounded-2xl px-4 py-3 text-center">
              <p className="text-xs text-ink/60 leading-relaxed">
                💡 <strong className="text-magic">ידעת?</strong> מורות פרטיות חוסכות בממוצע <strong>3 שעות הכנה בשבוע</strong> עם בשבילי — זמן שמוקדש ללמידה אמיתית
              </p>
            </div>

            {loadingElapsed >= 8 && typeof Notification !== "undefined" && Notification.permission !== "denied" && (
              <p className="text-center text-ink/35 text-xs">
                🔔 אפשר לנעול את המסך — נשלח התראה כשהחוברת מוכנה
              </p>
            )}
          </div>
        ) : (!isPro && remaining === 0) ? (
          <button
            onClick={() => openUpgrade()}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            🚀 שדרגי לפרו להמשיך
          </button>
        ) : (
          <button onClick={create} disabled={!canSubmit}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-2xl py-4 px-6 font-display font-bold text-base disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all shadow-md">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">{mode === "quick" ? "⚡" : mode === "exam" ? "📝" : "✨"}</span>
              <span>{mode === "quick" ? "צור דף מהיר" : mode === "exam" ? `צור מבחן (${pageCount} עמ')` : `צור חוברת (${pageCount} עמ')`}</span>
            </div>
            {canSubmit && <p className="text-white/50 text-xs font-normal mt-0.5">Ctrl+Enter</p>}
          </button>
        )}
      </div>
    </section>
    </>
  );
}
