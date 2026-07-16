import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeBookletHtml } from "../lib/sanitize";
import Preview from "./Preview";
import BookletRating from "./BookletRating";
import UpgradeModal from "./UpgradeModal";
import { FREE_LIMIT } from "../hooks/useProfile";
import { useChildren } from "../hooks/useChildren";
import { track } from "../hooks/useEvents";
import { IS_INAPP, openExternal } from "../lib/inapp";

const WORLDS = [
  "כדורגל", "גיימינג", "כדורסל", "מינקראפט", "פוקימון",
  "חיות", "סוסים", "דינוזאורים", "חלל", "ים וגלים",
  "בישול ואפייה", "מוזיקה", "ריקוד", "אמנות וציור",
  "נינג'ה", "קסמים", "רובוטיקה", "טבע ויערות",
  "ספורט כללי", "מחשבים", "אחר",
];
const WORLD_EMOJIS = {
  "כדורגל": "⚽", "גיימינג": "🎮", "כדורסל": "🏀", "מינקראפט": "⛏️", "פוקימון": "🐱",
  "חיות": "🐾", "סוסים": "🐴", "דינוזאורים": "🦕", "חלל": "🚀", "ים וגלים": "🌊",
  "בישול ואפייה": "🧁", "מוזיקה": "🎵", "ריקוד": "💃", "אמנות וציור": "🎨",
  "נינג'ה": "🥷", "קסמים": "🪄", "רובוטיקה": "🤖", "טבע ויערות": "🌿",
  "ספורט כללי": "🏅", "מחשבים": "💻", "אחר": "✏️",
};
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
const EMPTY = { childName: "", grade: "", world: "כדורגל", goal: "", level: "medium", weaknesses: "" };
// Page options are plan-aware: the teacher plan is SOLD as "עד 20 עמודים"
// (server TEACHER_MAX_PAGES=20) — the picker must actually offer it.
const PAGE_OPTIONS_FREE_PARENT = [2, 5, 7, 10];
const PAGE_OPTIONS_TEACHER     = [2, 5, 10, 15, 20];
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

// A4 @ 96dpi — same constants Preview.jsx uses, so the live-build preview below
// scales identically to the final booklet view. Used ONLY for the loading preview;
// does NOT touch the generation engine.
const A4_PX = 794;
const A4_H  = 1123;
// Count A4 pages emitted so far in the streamed HTML — each page div carries one
// `height:296mm`. Drives the live page-by-page progress. Display only; if a future
// engine changes the dimension this just returns 0 and the char bar takes over.
const countPages = (html) => (html.match(/296mm/g) || []).length;

export default function Create({ onSaved, remaining, isPro, plan = "free", active = true, bookletCount = 0, onUpgrade, pendingStarter = null, onStarterConsumed }) {
  const PAGE_OPTIONS = (plan === "teacher" || plan === "pro" || plan === "admin") ? PAGE_OPTIONS_TEACHER : PAGE_OPTIONS_FREE_PARENT;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const openUpgrade = onUpgrade ?? (() => setShowUpgrade(true));
  const [mode, setMode]           = useState(() => {
    try { return localStorage.getItem("beshvili_mode") || "quick"; } catch { return "quick"; }
  });
  const [f, setF]                 = useState(EMPTY);
  const [freeText, setFreeText]   = useState("");
  const [pageCount, setPageCount] = useState(2);
  const [fastMode, setFastMode]   = useState(false); // ⚡ faster, lighter generation
  const [withAnswerKey, setWithAnswerKey] = useState(false);
  const [examGrade,   setExamGrade]   = useState(EXAM_GRADES[2]);  // כיתה ה default
  const [examSubject, setExamSubject] = useState("");
  const [examTopic,   setExamTopic]   = useState("");
  const [noEmojis,    setNoEmojis]    = useState(true);             // formal by default
  const [customWorld, setCustomWorld] = useState("");
  const [loading, setLoading]     = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [previewHtml, setPreviewHtml] = useState(""); // live booklet-in-progress (display only)
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [html, setHtml]           = useState(null);
  const [bookletId, setBookletId] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [bookletTitle, setBookletTitle] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);   // generated OK but cloud-save failed
  const [cappedPages, setCappedPages] = useState(null);    // in-app cap shortened the booklet
  // In-app browsers are capped at 3 pages server-side. Asking for more must be
  // stopped BEFORE generation — otherwise a paying teacher burns a booklet from
  // her monthly quota and gets 3 pages instead of 20 (real customer complaint).
  const [inappCapWarn, setInappCapWarn] = useState(false);
  const inappCapAckRef = useRef(false);                    // user chose "create 3 pages anyway"
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
  const retryCountRef  = useRef(0);      // auto-retry: 0=fresh, 1=used first retry
  const netRetryRef    = useRef(0);      // initial-connect auto-retry (flaky networks)
  const retryTimerRef  = useRef(null);   // pending retry setTimeout id
  const createRef      = useRef(null);   // stable pointer to latest create()

  // Rotate loading messages every 3.5 s while generating; tick elapsed seconds
  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); setStreamChars(0); setLoadingElapsed(0); setPreviewHtml(""); return; }
    const msgId = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 3500);
    const secId = setInterval(() => setLoadingElapsed(s => s + 1), 1000);
    return () => { clearInterval(msgId); clearInterval(secId); };
  }, [loading]);

  // Abort any in-flight SSE stream on unmount; cancel pending auto-retry
  useEffect(() => () => {
    streamAbortRef.current?.abort();
    clearTimeout(retryTimerRef.current);
  }, []);

  // Onboarding starter: pre-fill the form so a first-timer's create button is
  // already enabled — one tap to their first booklet.
  useEffect(() => {
    if (!pendingStarter) return;
    setF(p => ({
      ...p,
      childName: pendingStarter.childName ?? p.childName,
      grade: pendingStarter.grade ?? p.grade,
      world: pendingStarter.world ?? p.world,
      goal:  pendingStarter.goal  ?? p.goal,
      level: pendingStarter.level ?? p.level,
      // Corrective booklet: results reported via the printed QR become a
      // targeted-practice hint the server prompt already knows how to use.
      weaknesses: pendingStarter.weaknesses ?? p.weaknesses ?? "",
    }));
    if (pendingStarter.mode) { setMode(pendingStarter.mode); try { localStorage.setItem("beshvili_mode", pendingStarter.mode); } catch {} }
    onStarterConsumed?.();
    setTimeout(() => document.getElementById("create-submit-btn")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  }, [pendingStarter]);

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

  const canSubmit = !loading && !rateCountdown && (
    mode === "free"  ? freeText.trim().length > 5 :
    mode === "quick" ? f.goal.trim().length > 2 :
    mode === "exam"  ? (examSubject.trim().length > 0 && examTopic.trim().length > 1) :
    !!(f.childName.trim() && f.goal.trim())
  );

  // Recover a booklet whose cloud save failed in a previous session: silently
  // re-insert the local stash so the ~90s generation isn't lost after tab close.
  useEffect(() => {
    (async () => {
      let stash = null;
      try { stash = JSON.parse(localStorage.getItem("beshvili_unsaved_booklet") || "null"); } catch {}
      if (!stash) return;
      // Claim the stash SYNCHRONOUSLY before the async insert — StrictMode runs
      // this effect twice and a second tab races it; removing first means only
      // one runner inserts (the loser reads null and bails).
      try { localStorage.removeItem("beshvili_unsaved_booklet"); } catch {}
      if (!stash.html || !stash.title || Date.now() - (stash.at ?? 0) > 24 * 3600 * 1000) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error: err } = await supabase.from("booklets").insert({
        user_id: session.user.id, title: stash.title, html: stash.html,
      });
      if (err && !err.message?.includes("quota_exceeded")) {
        // Transient failure — put the stash back for the next mount to retry.
        try { localStorage.setItem("beshvili_unsaved_booklet", JSON.stringify(stash)); } catch {}
      }
      if (!err) { track("booklet_recovered_from_stash", {}); onSaved?.(); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useCallback(async () => {
    if (!canSubmit || creatingRef.current) return;
    // Block BEFORE anything is spent: in-app browsers (WhatsApp/Instagram/
    // Facebook webview) get a server-side 3-page cap, so a 4+ page request
    // would silently produce 3 pages AND consume a booklet from the quota.
    // Let the user escape to a real browser or knowingly accept 3 pages.
    // (quick mode always sends pageCount: 1 — the selector value is irrelevant there)
    if (IS_INAPP && mode !== "quick" && pageCount > 3 && !inappCapAckRef.current) {
      setInappCapWarn(true);
      track("inapp_cap_warning_shown", { pageCount });
      return;
    }
    setInappCapWarn(false);
    creatingRef.current = true;
    const startedAt = Date.now();   // true generation duration (not the stale loadingElapsed closure)
    setLoading(true);
    setHtml(null);
    setPreviewHtml("");
    setError(null);
    const effectiveWorld = f.world === "אחר" ? customWorld.trim() || "נושא חופשי" : f.world;
    const trackError = (type, extra = {}) => track("booklet_error", { type, mode, pageCount, ...extra });
    track("booklet_started", { mode, goal: mode === "exam" ? examTopic : f.goal, grade: mode === "exam" ? examGrade : f.grade, world: mode === "exam" ? null : effectiveWorld, pageCount, withAnswerKey, photo: !!photoUrl });

    // Ask for notification permission so we can alert when done (non-blocking)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const quickText = `דף תרגיל מהיר${f.childName ? ` עבור ${f.childName.trim()}` : ""}${f.grade ? `, כיתה ${f.grade}` : ""}. נושא: ${f.goal.trim()}${effectiveWorld ? `, עולם תוכן: ${effectiveWorld}` : ""}. צור עמוד A4 אחד עם 8–12 תרגילים מגוונים ומהנים. ללא שער ורפלקציה. קוד HTML גולמי בלבד.`;

    // In-app browsers (Facebook/Instagram/etc. webview) can't read an SSE stream —
    // their fetch fails as "network". Detect them and request a single non-stream
    // JSON response instead, so generation works without leaving the in-app browser.
    const ua = navigator.userAgent || "";
    const inApp = IS_INAPP;
    const useNoStream = inApp;

    const body = mode === "free"
      ? { freeText: freeText.trim(), pageCount, withAnswerKey }
      : mode === "quick"
      ? { freeText: quickText, pageCount: 1, withAnswerKey: false }
      : mode === "exam"
      ? { examMode: true, examGrade, examSubject, examTopic, noEmojis, pageCount, withAnswerKey }
      : { ...f, world: effectiveWorld, pageCount, withAnswerKey, ...(photoUrl ? { childPhotoUrl: photoUrl } : {}) };
    if (useNoStream) body.noStream = true;
    if (fastMode) body.fast = true;

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
      creatingRef.current = false;
      if (ctrl.signal.aborted) { setLoading(false); return; } // unmounted — don't show error
      // ROOT-CAUSE DIAGNOSTICS: capture WHAT actually failed instead of guessing.
      // (ua/inApp are computed once near the top of create().)
      const diag = {
        msg: String(e?.message || e).slice(0, 160),
        online: navigator.onLine,
        inapp: inApp,
        conn: navigator.connection?.effectiveType || null,
        ua: ua.slice(0, 180),
      };
      // Auto-retry once for a genuinely transient blip, but not in-app browsers
      // (their SSE failure is structural, not transient — retrying loops forever).
      if (netRetryRef.current < 1 && !inApp) {
        netRetryRef.current++;
        trackError("network_retrying", diag);
        // Clear loading so canSubmit=true when the retry fires — otherwise the
        // retried create() bails at the canSubmit guard and the spinner freezes forever.
        setLoading(false);
        setStreamChars(0); setLoadingElapsed(0); setLoadingMsgIdx(0);
        retryTimerRef.current = setTimeout(() => createRef.current?.(), 2000);
        return;
      }
      netRetryRef.current = 0;
      setLoading(false);
      // Self-describing error type → the admin panel badge tells us the root cause.
      const type = !navigator.onLine ? "network_offline" : inApp ? "network_inapp" : "network";
      trackError(type, diag);
      setError(
        inApp
          ? "generic:נראה שנכנסת מתוך אפליקציה (וואטסאפ/אינסטגרם). כדי ליצור חוברת — פתחי את הדף בדפדפן רגיל (Chrome/Safari): לחצי על ⋮ ← \"פתח בדפדפן\" 🙏"
          : !navigator.onLine
          ? "generic:אין חיבור לאינטרנט כרגע — בדקי את הרשת ונסי שוב"
          : "generic:לא הצלחנו להתחבר לשרת — בדקי את חיבור האינטרנט ונסי שוב 🙏",
      );
      return;
    }
    netRetryRef.current = 0; // reached the server — reset the connectivity retry

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
      if (code === "rate_limited") {
        const wait = errData?.wait ?? 60;
        // If this request WAS the auto-retry after a dropped stream, the server
        // kept the 60s lock on purpose — ride it out and retry once more instead
        // of dumping a countdown on a user who just lost a generation.
        if (retryCountRef.current > 0 && wait <= 60) {
          trackError("rate_limited_retry_wait", { wait });
          retryTimerRef.current = setTimeout(() => createRef.current?.(), (wait + 1) * 1000);
          setLoadingMsgIdx(0);
          return;
        }
        trackError("rate_limited", { wait }); setError(`rate:${wait}`); return;
      }
      if (code === "ai_overloaded") { trackError("ai_overloaded"); setError("generic:השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"); return; }
      if (code === "ai_timeout")    { trackError("ai_timeout", { inapp: useNoStream }); setError(useNoStream
        ? "generic:הייצור ארוך מדי לדפדפן של פייסבוק — פתחי בדפדפן (הכפתור למעלה) או בחרי פחות עמודים 🙏"
        : "generic:הייצור לקח יותר מדי זמן — נסי עם פחות עמודים"); return; }
      if (code === "ai_error")      { trackError("ai_error"); setError("generic:השרת נתקל בבעיה רגעית — נסי שוב 🙏"); return; }
      if (code === "internal_error"){ trackError("internal_error", { inapp: useNoStream }); setError(useNoStream
        ? "generic:הייצור ארוך מדי לדפדפן של פייסבוק — פתחי בדפדפן (הכפתור למעלה) 🙏"
        : "generic:שגיאה זמנית בשרת — נסי שוב 🙏"); return; }
      if (resp.status === 401)      { trackError("session_expired"); setError("generic:הסשן פג תוקף — רענן את הדף וכנסי מחדש"); return; }
      trackError("server_error", { status: resp.status, inapp: useNoStream });
      const detail = code || (rawBody.length < 80 ? rawBody : rawBody.substring(0, 60) + "…");
      setError(`generic:שגיאת שרת ${resp.status}${detail ? ` — ${detail}` : ""}`);
      return;
    }

    // Screen Wake Lock — prevents Android battery optimizer from killing the connection
    let wakeLock = null;
    try {
      if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    } catch {}

    let htmlAccumulated = "";
    let streamAborted = false;
    let streamHadError = false;
    let streamErrorMsg = null;
    let streamErrType = null;
    let stopReason = null; // Anthropic message_delta.stop_reason — "max_tokens" = truncated

    if (useNoStream) {
      // In-app browser path: the server returns the whole booklet in one JSON.
      // Guard against the platform wall-clock limit (130s server-side) — abort
      // at 125s on the client so we can show a meaningful error instead of hanging.
      let noStreamTimedOut = false;
      const noStreamTimeoutId = setTimeout(() => { noStreamTimedOut = true; ctrl.abort(); }, 125_000);
      try {
        const j = await resp.json();
        clearTimeout(noStreamTimeoutId);
        htmlAccumulated = j?.html ?? "";
        if (j?.capped) setCappedPages(j.pages ?? 3); // FB cap shortened the booklet
      } catch (e) {
        clearTimeout(noStreamTimeoutId);
        wakeLock?.release().catch(() => {});
        if (ctrl.signal.aborted && !noStreamTimedOut) { creatingRef.current = false; return; } // unmounted
        setLoading(false); creatingRef.current = false;
        if (noStreamTimedOut) {
          trackError("nostream_timeout", { pages: pageCount });
          setError("generic:הייצור ארוך מדי — נסי עם פחות עמודים, או פתחי בדפדפן רגיל (הכפתור למעלה) 🙏");
          return;
        }
        trackError("nostream_parse_failed", { msg: String(e).slice(0, 120) });
        setError("generic:לא הצלחנו לקבל את החוברת — נסי שוב 🙏");
        return;
      }
    } else {
    // Read SSE stream — Anthropic sends content_block_delta events with text chunks
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let updateTimer = 0;
    let previewTimer = 0; // throttles the live-build iframe (heavier than the char counter)

    // Stall guards: a hung Anthropic stream still keeps the HTTP connection alive
    // via the server's keep-alive heartbeats, so without these the user can wait
    // minutes (we've seen 185s+) with zero progress. Bail out and let the catch
    // below auto-retry, instead of spinning forever.
    const DEAD_CONN_MS     = 30000; // no bytes at all (not even a heartbeat) → dead connection
    const CONTENT_STALL_MS = 90000; // alive but zero new HTML → stalled. 90s headroom so a slow
                                    // first token under load isn't false-aborted (which would
                                    // abandon a paid gen mid-flight and retry = double cost).
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
              // Throttle React state updates to ~10fps
              const now = Date.now();
              if (now - updateTimer > 100) {
                setStreamChars(htmlAccumulated.length);
                updateTimer = now;
              }
              // Live build preview: snapshot the HTML-so-far at a gentle cadence.
              // Each update re-renders the sandboxed iframe, so keep it ~2s to read
              // as a calm refresh (not a strobe) while still feeling live.
              if (now - previewTimer > 2000) {
                setPreviewHtml(htmlAccumulated);
                previewTimer = now;
              }
            } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
              stopReason = ev.delta.stop_reason;
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
        // Progress check: reset the stall clock when new HTML arrived; otherwise
        // a long gap with only heartbeats means the generation is stuck.
        if (htmlAccumulated.length > beforeLen) lastContentAt = Date.now();
        else if (Date.now() - lastContentAt > CONTENT_STALL_MS) throw new Error("content_stalled");
        if (streamHadError) break;
      }
    } catch (streamErr) {
      wakeLock?.release().catch(() => {});
      // Unmounted / navigated away mid-stream: don't setState or save a booklet
      // the user abandoned.
      if (ctrl.signal.aborted) { creatingRef.current = false; return; }
      // Kill the zombie connection — a stalled stream left open keeps the server-side
      // generation running (double API cost) and contends with the per-user rate limit.
      ctrl.abort();
      // Save partial booklet if we got substantial HTML (e.g. connection dropped mid-stream)
      const partial = htmlAccumulated.trim();
      if (partial.length > 8000 && (partial.includes("<!DOCTYPE") || partial.includes("<html"))) {
        if (!partial.includes("</html>")) htmlAccumulated = partial + "\n</body></html>";
        streamAborted = true;
        // Fall through to save the partial booklet below
      } else if (retryCountRef.current < 1) {
        // Auto-retry once after a dropped stream. Clear loading so canSubmit becomes
        // true when the setTimeout fires — without this, create() exits immediately
        // because !loading is false and the spinner freezes forever.
        retryCountRef.current++;
        trackError("stream_dropped_retrying");
        setStreamChars(0);
        setLoadingElapsed(0);
        setLoadingMsgIdx(0);
        creatingRef.current = false;
        setLoading(false);
        retryTimerRef.current = setTimeout(() => createRef.current?.(), 2000);
        return;
      } else {
        retryCountRef.current = 0;
        setLoading(false);
        creatingRef.current = false;
        trackError("stream_dropped");
        setError(`generic:החיבור נקטע — לחצי שוב על "צור חוברת" כדי לנסות שוב${pageCount > 3 ? " (רצוי עם פחות עמודים)" : ""}`);
        return;
      }
    }
    } // end streaming branch

    wakeLock?.release().catch(() => {});
    setLoading(false);
    creatingRef.current = false;
    // Successful stream — restore the auto-retry budget for the next booklet.
    retryCountRef.current = 0;
    netRetryRef.current = 0;

    if (streamHadError) { trackError("stream_error", { errType: streamErrType }); setError(streamErrorMsg); return; }

    // Truncated by the token budget: the booklet is incomplete (missing its last
    // page). Mark it partial + close the tags so it isn't saved as if whole.
    if (stopReason === "max_tokens") {
      trackError("max_tokens_truncated", { chars: htmlAccumulated.length, pages: pageCount });
      const t = htmlAccumulated.trim();
      if (!t.includes("</html>")) htmlAccumulated = t + "\n</body></html>";
      streamAborted = true;
    }

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

    const bookletRow = {
      user_id: session.user.id, title,
      child_name: f.childName || null, grade: f.grade || null,
      world: mode === "exam" ? null : (effectiveWorld || null),
      goal: mode === "free" ? freeText.trim().substring(0, 200) : mode === "exam" ? examTopic : f.goal,
      level: f.level, html: generatedHtml,
    };
    // Retry the save once on a transient failure before giving up — a ~90s
    // generation shouldn't be lost to a momentary network/DB blip.
    let inserted = null, insertErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await supabase.from("booklets").insert(bookletRow).select("id, share_token").single();
      inserted = res.data; insertErr = res.error;
      if (!insertErr) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }
    if (insertErr) {
      // DB trigger enforce_booklet_quota fires AFTER the Edge Function quota check
      // passes (race window). Surface it as the real paywall instead of a save-failure
      // warning, which would confuse the user ("I thought I had quota?").
      if (insertErr.message?.includes("quota_exceeded")) {
        trackError("quota_exceeded_db");
        setError("quota");
        return;
      }
      // A save failure must NOT discard a ~90s generation — show the booklet so the
      // user can still print / download it, and stash it locally as a recovery
      // buffer so closing the tab doesn't lose it entirely.
      try { localStorage.setItem("beshvili_unsaved_booklet", JSON.stringify({ title, html: generatedHtml, at: Date.now() })); } catch { /* quota/full — ignore */ }
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
    // pagesDelivered vs pages(requested): the field that reveals whether long
    // (15–20 page) requests actually complete or get cut by token/time limits.
    track("booklet_completed", { booklet_id: inserted?.id, pages: pageCount, pagesDelivered: countPages(htmlAccumulated), mode, durationSec: Math.round((Date.now() - startedAt) / 1000), chars: htmlAccumulated.length, partial: streamAborted, withAnswerKey, booklet_index: bookletCount + 1 });
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
  }, [canSubmit, mode, freeText, f, pageCount, withAnswerKey, onSaved, photoUrl, examGrade, examSubject, examTopic, noEmojis, customWorld, fastMode, bookletCount]);
  createRef.current = create; // keep stable pointer for auto-retry

  useEffect(() => {
    if (!active) return;
    // !html guard: on the success screen canSubmit is still true, so Ctrl+Enter
    // would silently regenerate, discard the booklet view, and burn quota.
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !html) create(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [create, active, html]);

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    track("photo_upload_started", { size_bytes: file.size });
    if (file.size > 5 * 1024 * 1024) { track("photo_upload_failed", { reason: "too_large" }); alert("תמונה גדולה מדי — מקסימום 5MB"); return; }
    setPhotoUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPhotoUploading(false); return; }
    const ext = file.name.split(".").pop() || "jpg";
    // Unguessable filename: a shared booklet embeds this public URL (leaking the
    // user's folder id), so a timestamp name let someone brute-force a user's
    // OTHER children's photos. A random UUID makes each photo a secret capability.
    const rand = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
    const path = `${user.id}/${rand}.${ext}`;
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

  const reset = () => { setHtml(null); setF(EMPTY); setFreeText(""); setError(null); setBookletId(null); setShareToken(null); setBookletTitle(null); setShowRating(false); setChildSaved(false); setPhotoUrl(null); setSaveWarning(false); setCappedPages(null); };
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
        {/* In-app cap notice — the booklet was shortened because it was made inside Facebook */}
        {cappedPages && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 text-right">
            <p className="font-bold text-blue-800 text-sm">ℹ️ נוצרו {cappedPages} עמודים (במקום המספר שביקשת)</p>
            <p className="text-xs text-blue-700 mt-1">בדפדפן פנימי (וואטסאפ/אינסטגרם/פייסבוק) מוגבל ל-{cappedPages} עמודים. לחוברת המלאה — פתחי את beshvili.com ב-Chrome/Safari ונסי שוב.</p>
          </div>
        )}

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
          {bookletCount === 0 && !f.goal && (
            <div className="flex items-center gap-2 bg-magic/6 border border-magic/15 rounded-xl px-3 py-2 mb-2 text-xs text-magic/80">
              <span className="flex-shrink-0">☝️</span>
              <span><strong>לחצי על נושא</strong> ← הטופס יתמלא אוטומטית. אחר כך רק "צור חוברת" ב-60 שניות</span>
            </div>
          )}
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
              <div className="flex flex-wrap gap-1.5">
                {WORLDS.map((w) => (
                  <button key={w} type="button" disabled={loading}
                    onClick={() => setF(p => ({ ...p, world: w }))}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors disabled:opacity-30 ${
                      f.world === w
                        ? "bg-magic text-white border-magic shadow-sm"
                        : "border-ink/15 text-ink/50 bg-canvas/50 hover:border-magic/50 hover:text-ink/70"
                    }`}>
                    <span>{WORLD_EMOJIS[w]}</span><span>{w}</span>
                  </button>
                ))}
              </div>
              {f.world === "אחר" && (
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 mt-2 outline-none focus:border-magic text-right bg-canvas/50"
                  placeholder="למשל: בלט, כדורעף, כישוף, ספרים..."
                  value={customWorld}
                  onChange={(e) => setCustomWorld(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              )}
            </div>
            <div>
              {f.weaknesses && (
                <div className="flex items-start gap-2 bg-magic/8 border border-magic/25 rounded-xl px-3 py-2 mb-2">
                  <span className="text-base leading-none mt-0.5">🎯</span>
                  <p className="flex-1 text-xs text-magic font-medium leading-relaxed">
                    חוברת תיקון — תתמקד ב: <span className="font-semibold">{f.weaknesses}</span>
                  </p>
                  <button type="button" onClick={() => setF(p => ({ ...p, weaknesses: "" }))} aria-label="בטל מיקוד"
                    className="text-magic/50 hover:text-magic text-lg leading-none flex-shrink-0">×</button>
                </div>
              )}
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
            <div>
              <p className="text-xs text-ink/40 mb-1.5 font-medium">עולם התוכן — מה הילד/ה אוהב?</p>
              <div className="flex flex-wrap gap-1.5">
                {WORLDS.map((w) => (
                  <button key={w} type="button" disabled={loading}
                    onClick={() => setF(p => ({ ...p, world: w }))}
                    className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors disabled:opacity-30 ${
                      f.world === w
                        ? "bg-magic text-white border-magic shadow-sm"
                        : "border-ink/15 text-ink/50 bg-canvas/50 hover:border-magic/50 hover:text-ink/70"
                    }`}>
                    <span>{WORLD_EMOJIS[w]}</span><span>{w}</span>
                  </button>
                ))}
              </div>
              {f.world === "אחר" && (
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 mt-2 outline-none focus:border-magic text-right bg-canvas/50"
                  placeholder="למשל: בלט, כדורעף, כישוף, ספרים..."
                  value={customWorld}
                  onChange={(e) => setCustomWorld(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              )}
            </div>
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
              const isLocked = !isPro && n > 2;
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
          {!isPro && <p className="text-[10px] text-ink/30 mt-1 text-center">חוברות גדולות יותר (5–10 עמ') זמינות בתוכנית בתשלום</p>}
          {isPro && <p className="text-[10px] text-grow/70 mt-1 text-center">💡 המכסה נספרת בחוברות, לא בעמודים — חוברת של 20 עמודים = חוברת אחת מהמכסה</p>}
        </div>}

        {/* Answer key toggle — hidden in quick mode; a PAID selling point, so
            free users see it locked (tapping opens the upgrade offer) */}
        {mode !== "quick" && (
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-medium text-ink">מפתח תשובות {!isPro && "🔒"}</span>
              <span className="text-xs text-ink/40 mr-2">{isPro ? "דף תשובות בסוף החוברת" : "זמין בתוכנית בתשלום"}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPro && withAnswerKey}
              aria-label="מפתח תשובות"
              onClick={() => {
                if (loading) return;
                if (!isPro) { track("upgrade_intent_clicked", { source: "answer_key_toggle" }); onUpgrade?.(); return; }
                setWithAnswerKey(v => !v);
              }}
              disabled={loading}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magic ${isPro && withAnswerKey ? "bg-magic" : "bg-ink/20"} ${!isPro ? "opacity-60" : ""}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPro && withAnswerKey ? "right-0.5" : "left-0.5"}`} />
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
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            {error.replace("generic:", "")}
          </div>
        )}

        {/* Submit / loading */}
        {loading ? (
          <div className="py-10 space-y-5">
            {/* Live build preview — the child/parent watches their booklet take
                shape page by page instead of staring at a spinner. Display only:
                same A4 constants + sandboxed srcDoc as the final Preview, so it
                scales identically. Touches NOTHING in the generation engine.
                Shows the orb until the <style>/<head> has streamed (first seconds),
                then swaps to the live page that's currently being written. */}
            {(previewHtml.includes("</style>") || previewHtml.includes("</head>")) ? (
              <div className="flex justify-center">
                <div
                  dir="ltr"
                  className="relative rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white"
                  style={{ width: 300, height: Math.round(A4_H * (300 / A4_PX)) }}
                >
                  <iframe
                    title="תצוגה חיה של החוברת"
                    srcDoc={previewHtml}
                    sandbox="allow-scripts"
                    style={{
                      width: `${A4_PX}px`,
                      height: `${(mode === "quick" ? 1 : pageCount) * A4_H}px`,
                      transform: `scale(${300 / A4_PX}) translateY(-${Math.max(0, Math.min((mode === "quick" ? 1 : pageCount) - 1, countPages(previewHtml) - 1)) * A4_H}px)`,
                      transformOrigin: "top left",
                      border: "none",
                      display: "block",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transition: "transform 0.7s ease",
                    }}
                  />
                  <div className="absolute top-2 right-2 bg-magic/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> חי
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-magic/20 border-t-magic animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-brand/20 border-b-brand animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">✨</div>
                </div>
              </div>
            )}

            {/* Context-aware title — announced to screen readers so blind users
                aren't left in silence through the 60–90s generation. */}
            <div className="text-center" role="status" aria-live="polite">
              <p className="font-display font-bold text-ink text-lg">
                {mode === "exam"
                  ? `📝 מכין מבחן ${examSubject}${examGrade ? ` — ${examGrade}` : ""}`
                  : f.childName
                  ? `✨ יוצרת עבור ${f.childName}`
                  : "✨ יוצרת חוברת..."}
              </p>
              <p className="text-ink/55 text-sm mt-1">{LOADING_MSGS[loadingMsgIdx]}</p>
            </div>

            {/* Page-by-page progress — concrete, honest feedback from the actual
                streamed pages (not a fabricated timer). Hidden for single-page modes. */}
            {(mode === "quick" ? 1 : pageCount) > 1 && (
              <div className="space-y-1.5">
                <div className="flex justify-center gap-1.5">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${i < countPages(previewHtml) ? "bg-gradient-to-l from-magic to-grow w-7" : "bg-ink/10 w-4"}`}
                    />
                  ))}
                </div>
                {countPages(previewHtml) > 0 && (
                  <p className="text-center text-xs text-ink/45">
                    בונה עמוד {Math.min(pageCount, countPages(previewHtml))} מתוך {pageCount} ✍️
                  </p>
                )}
              </div>
            )}

            {/* Progress bar + stats */}
            <div className="space-y-1.5">
              <div className="w-full bg-canvas rounded-full h-2.5 overflow-hidden">
                {streamChars > 0
                  ? <div className="h-full bg-gradient-to-l from-brand via-magic to-grow rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(97, (streamChars / ((mode === "quick" ? 1 : pageCount) * 3200)) * 100)}%` }} />
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
          <>
          {/* Speed vs depth: let the user trade quality for a much faster (and cheaper) result */}
          {mode !== "quick" && (
            <button
              type="button"
              onClick={() => setFastMode(v => !v)}
              className={`w-full mb-2 rounded-xl p-3 text-sm font-medium border transition-all flex items-center justify-between ${
                fastMode ? "border-brand bg-brand/8 text-ink" : "border-ink/15 bg-white text-ink/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{fastMode ? "⚡" : "📚"}</span>
                {fastMode ? "מצב מהיר — דף קליל, מוכן הרבה יותר מהר" : "מצב מלא — דף עשיר ומפורט (איטי יותר)"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${fastMode ? "bg-brand text-white" : "bg-ink/10 text-ink/50"}`}>
                {fastMode ? "מהיר" : "מלא"}
              </span>
            </button>
          )}
          {inappCapWarn && (
            <div className="mb-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-right space-y-3">
              <p className="font-bold text-amber-900 text-sm">📱 את/ה בדפדפן פנימי (וואטסאפ/אינסטגרם/פייסבוק)</p>
              <p className="text-xs text-amber-800">
                כאן אפשר ליצור עד 3 עמודים בלבד. חוברת של {pageCount} עמודים דורשת דפדפן רגיל (Chrome/Safari) — שנייה לפתוח, ואותה חוברת בדיוק.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => { track("inapp_cap_open_browser", { pageCount }); openExternal(window.location.href); }}
                  className="flex-1 bg-magic text-white rounded-xl py-2.5 px-4 text-sm font-bold hover:opacity-90">
                  🌐 פתחי בדפדפן רגיל — לחוברת המלאה
                </button>
                <button onClick={() => { inappCapAckRef.current = true; setInappCapWarn(false); track("inapp_cap_proceed_3", { pageCount }); create(); }}
                  className="flex-1 bg-white border border-amber-300 text-amber-900 rounded-xl py-2.5 px-4 text-sm font-semibold hover:bg-amber-100">
                  להמשיך כאן עם 3 עמודים
                </button>
              </div>
            </div>
          )}
          <button id="create-submit-btn" onClick={create} disabled={!canSubmit}
            className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-2xl py-4 px-6 font-display font-bold text-base disabled:opacity-40 hover:opacity-90 active:scale-[0.98] transition-all shadow-md">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">{mode === "quick" ? "⚡" : mode === "exam" ? "📝" : "✨"}</span>
              <span>{mode === "quick" ? "צור דף מהיר" : mode === "exam" ? `צור מבחן (${pageCount} עמ')` : `צור חוברת (${pageCount} עמ')`}</span>
            </div>
            {canSubmit && <p className="text-white/50 text-xs font-normal mt-0.5">Ctrl+Enter</p>}
          </button>
          </>
        )}
        {/* Tell first-timers exactly what's missing instead of a silently-disabled button */}
        {!loading && !canSubmit && !(!isPro && remaining === 0) && (
          <p className="text-center text-xs text-magic/70 mt-2 font-medium">
            {mode === "free"  ? "👆 כתוב/כתבי מה ליצור כדי להמשיך"
              : mode === "exam"  ? (!examSubject ? "👆 בחר/י מקצוע" : "👆 כתוב/כתבי את נושא המבחן")
              : mode === "form"  ? (!f.childName.trim() && !f.goal.trim() ? "👆 מלא/י שם ילד/ה ומה לתרגל"
                                    : !f.childName.trim() ? "👆 מלא/י שם ילד/ה"
                                    : "👆 כתוב/כתבי מה לתרגל")
              : "👆 בחר/י נושא למעלה או כתוב/כתבי מה לתרגל — ואז 'צור'"}
          </p>
        )}
      </div>
    </section>
    </>
  );
}
