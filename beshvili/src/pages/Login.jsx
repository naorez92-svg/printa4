import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";
import Logo from "../components/Logo";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
  </svg>
);

// ── Branded inline-SVG icon system ──
// Flat, geometric, rounded — matches Logo.jsx style (1–3 brand colors per icon).
// Brand: ink #20184A · brand #F4A02C · magic #6C5CE7 · grow #1FB58F
const iconBase = { viewBox: "0 0 100 100", "aria-hidden": "true" };

// Teacher / private tutor — a graduation cap (flat).
const IconTeacher = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <path d="M50 22 92 40 50 58 8 40z" fill="#6C5CE7" />
    <path d="M28 50v16c0 6 10 12 22 12s22-6 22-12V50L50 60z" fill="#F4A02C" />
    <rect x="89" y="40" width="4" height="26" rx="2" fill="#6C5CE7" />
    <circle cx="91" cy="68" r="5" fill="#F4A02C" />
  </svg>
);

// Classroom teacher — a school building (flat).
const IconClass = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <path d="M50 14 88 36H12z" fill="#1FB58F" />
    <rect x="20" y="36" width="60" height="48" rx="6" fill="#1FB58F" />
    <rect x="34" y="50" width="14" height="14" rx="3" fill="#F7F6FB" />
    <rect x="52" y="50" width="14" height="14" rx="3" fill="#F7F6FB" />
    <rect x="42" y="68" width="16" height="16" rx="3" fill="#20184A" />
  </svg>
);

// Parent / child — figure with a star (flat).
const IconParent = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <circle cx="42" cy="30" r="16" fill="#F4A02C" />
    <path d="M16 84c0-16 12-26 26-26s26 10 26 26z" fill="#F4A02C" />
    <path d="M74 18l5 11 12 2-9 9 2 12-10-6-10 6 2-12-9-9 12-2z" fill="#6C5CE7" />
  </svg>
);

// Step 1 — write / pencil (flat).
const IconWrite = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <rect x="20" y="18" width="40" height="64" rx="20" transform="rotate(-45 40 50)" fill="#6C5CE7" />
    <path d="M26 70l-6 14 14-6z" fill="#F4A02C" />
    <rect x="58" y="22" width="14" height="14" rx="3" transform="rotate(45 65 29)" fill="#20184A" />
  </svg>
);

// Step 2 — AI spark / wand (flat).
const IconSpark = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <path d="M48 8l8 26 26 8-26 8-8 26-8-26-26-8 26-8z" fill="#6C5CE7" />
    <path d="M78 60l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#F4A02C" />
  </svg>
);

// Step 3 — printer (flat).
const IconPrint = ({ size = 32, className = "" }) => (
  <svg width={size} height={size} {...iconBase} className={className}>
    <rect x="28" y="14" width="44" height="22" rx="4" fill="#20184A" />
    <rect x="16" y="34" width="68" height="34" rx="8" fill="#6C5CE7" />
    <circle cx="72" cy="48" r="4" fill="#1FB58F" />
    <rect x="30" y="58" width="40" height="28" rx="4" fill="#F4A02C" />
    <rect x="38" y="66" width="24" height="4" rx="2" fill="#20184A" opacity="0.4" />
    <rect x="38" y="74" width="24" height="4" rx="2" fill="#20184A" opacity="0.4" />
  </svg>
);

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

const SUBJECTS = ["חשבון 📐", "עברית ✍️", "אנגלית 🌍", "מדעים 🔬", "היסטוריה 📜", "גיאוגרפיה 🗺️"];

const TICKER_ITEMS = [
  "📚 נועה מת\"א יצרה חוברת חשבון לכיתה ד",
  "📚 שרית מחיפה יצרה חוברת עברית לגיל 9",
  "📚 רחל מירושלים הדפיסה חוברת מדעים לכיתה ה",
  "📚 אורית מב\"ש יצרה חוברת לתלמיד עם דיסלקציה",
  "📚 מיכל מרמת גן יצרה חוברת אנגלית לכיתה ג",
  "📚 דנה מפ\"ת יצרה חוברת היסטוריה לכיתה ו",
  "📚 יעל מנתניה יצרה חוברת גיאוגרפיה",
  "📚 עדי מהרצליה יצרה חוברת לתלמידה עם ADHD",
];

const TESTIMONIALS = [
  {
    initials: "נ", name: "נועה ל.", role: "מורה פרטית, תל אביב", color: "bg-magic",
    quote: "חסכתי 4 שעות הכנה השבוע. כל תלמיד מקבל חוברת אישית בדיוק לפי הקשיים שלו — זה שינה לי את הגישה לחלוטין.",
  },
  {
    initials: "ש", name: "שרית מ.", role: "מחנכת כיתה ד, ראשון לציון", color: "bg-brand",
    quote: "הכנתי חוברת חזרה לפני מבחן ל-28 ילדים תוך 3 דקות. לא האמנתי שזה אפשרי. הדפסתי ישר מהטלפון.",
  },
  {
    initials: "א", name: "אורית כ.", role: "אמא לבן כיתה ג", color: "bg-grow",
    quote: "הבן שלי לא מתנגד יותר לשיעורים. חוברת כדורגל אישית שלו — הוא לא מרגיש שהוא לומד. השיפור בציונים מדבר בעד עצמו.",
  },
];

// Supabase auth errors arrive in English ("Failed to fetch", "Network request
// failed", "Email rate limit exceeded"…). Israeli users must never see a raw
// English string, so map the common cases to Hebrew. Network/connectivity
// failures are the most frequent in the field (flaky mobile data, in-app
// browsers) and are exactly what reads as a confusing "שגיאת שרת".
function friendlyAuthError(err) {
  const msg = (err && err.message) || "";
  if (/failed to fetch|network ?request failed|networkerror|load failed|fetch/i.test(msg)) {
    return "בעיית תקשורת — בדקי את החיבור לאינטרנט ונסי שוב 🙏";
  }
  if (/invalid|not a valid email|unable to validate email/i.test(msg)) {
    return "כתובת המייל לא תקינה — בדקי שוב";
  }
  if (/rate limit|too many/i.test(msg)) {
    return "נשלחו יותר מדי בקשות — המתיני רגע ונסי שוב";
  }
  // A Hebrew message from Supabase (rare) or any unknown case: show it as-is
  // only if it has Hebrew chars, otherwise a safe Hebrew fallback.
  return /[֐-׿]/.test(msg) ? msg : "שגיאה בשליחה — נסי שנית";
}

export default function Login() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [email, setEmail] = useState("");
  const [step, setStep]   = useState("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSent, setHeroSent] = useState(false);
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroError, setHeroError] = useState("");
  const [subjectIdx, setSubjectIdx]       = useState(0);
  const [subjectVisible, setSubjectVisible] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  // Magic-link / OAuth errors come back in the URL (hash or query). Without this
  // the user lands silently with no idea why login failed. Read it once, show a
  // Hebrew message, and strip the params so a refresh is clean.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const qs   = new URLSearchParams(window.location.search);
    const errCode = hash.get("error_code") || hash.get("error") || qs.get("error_code") || qs.get("error");
    const errDesc = hash.get("error_description") || qs.get("error_description") || "";
    if (!errCode) return;
    const map = {
      otp_expired: "הקישור פג תוקף — בקשי קישור חדש ולחצי עליו תוך כמה דקות 🙏",
      access_denied: "הכניסה בוטלה — נסי שוב",
    };
    setError(map[errCode] || (errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "הכניסה נכשלה — נסי לבקש קישור חדש");
    setStep("email");
    track("auth_redirect_error", { code: errCode });
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setSubjectVisible(false);
      setTimeout(() => { setSubjectIdx(i => (i + 1) % SUBJECTS.length); setSubjectVisible(true); }, 280);
    }, 2400);
    return () => clearInterval(t);
  }, []);

  // Fire auth_verify_screen_view once when the verify screen renders.
  useEffect(() => {
    if (step === "verify") track("auth_verify_screen_view", {});
  }, [step]);

  // Section views — observe key sections once each via IntersectionObserver.
  useEffect(() => {
    const ids = ["pricing", "login-form"];
    const seen = new Set();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !seen.has(entry.target.id)) {
          seen.add(entry.target.id);
          track("section_view", { section: entry.target.id });
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.3 });
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const goToLoginForm = (location) => {
    track("cta_click", { location });
    scrollTo("login-form");
  };

  const signInWithGoogle = async () => {
    track("auth_google_click", { method: "google" });
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      track("auth_google_error", { error: err.message });
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  };

  const sendFromHero = async () => {
    if (!heroEmail.trim()) return;
    track("auth_email_submitted", { method: "magic_link", location: "hero" });
    setHeroLoading(true);
    setHeroError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: heroEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setHeroLoading(false);
    if (err) {
      const msg = err.message || "";
      // Only a genuine throttle (HTTP 429 / "after N seconds") means the link was
      // already sent. Any OTHER error must surface, not be silently swallowed as "sent".
      const alreadySent = err.status === 429 || /after \d+ second/i.test(msg);
      if (alreadySent) {
        setHeroSent(true);
      } else {
        track("auth_email_error", { error: msg, location: "hero" });
        setHeroError(friendlyAuthError(err));
      }
    } else {
      track("auth_email_sent", { method: "magic_link", location: "hero" });
      setHeroSent(true);
    }
  };

  const send = async () => {
    if (!email.trim()) return;
    track("auth_email_submitted", { method: "magic_link" });
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (err) {
      const msg = err.message || "";
      // Only a genuine throttle (429 / "after N seconds") means the link is already
      // out. Every other error must be shown, not hidden behind the verify screen.
      const alreadySent = err.status === 429 || /after \d+ second/i.test(msg);
      if (alreadySent) {
        track("auth_email_rate_limited", {});
        setStep("verify");
      } else {
        track("auth_email_error", { error: msg });
        setError(friendlyAuthError(err));
      }
    } else {
      track("auth_email_sent", { method: "magic_link" });
      setStep("verify");
    }
  };

  return (
    <div className="min-h-screen bg-canvas" dir="rtl">

      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink/5">
        <div className="max-w-4xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-ink text-lg font-display">בשבילי<span className="text-brand">·</span></span>
          </div>
          {/* Outline (not gradient) so the single hero CTA wins the eye. */}
          <button
            onClick={() => goToLoginForm("nav")}
            className="border border-magic/40 text-magic text-sm rounded-xl px-4 py-2 font-medium hover:bg-magic/5 transition-colors"
          >
            כניסה חינמית ✨
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative bg-ink py-20 px-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-magic/30 to-brand/20 pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-magic/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/70">
            <span className="w-2 h-2 bg-grow rounded-full animate-pulse inline-block flex-shrink-0" />
            120+ מורות פרטיות · ⭐ 4.9/5 · 500+ חוברות נוצרו
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-display leading-tight">
            הפסיקי להכין דפי עבודה ידנית —<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand to-[#A78BFA]">
              תני ל-AI לעשות את זה
            </span>
          </h1>
          <p className="text-xl text-white/65 leading-relaxed max-w-lg mx-auto">
            מורות פרטיות חוסכות <strong className="text-brand">3+ שעות הכנה בשבוע</strong>. חוברת עבודה מלאה בעברית, מותאמת לכל תלמיד — מוכנה להדפסה תוך 60 שניות
          </p>
          <button
            onClick={() => goToLoginForm("hero")}
            className="inline-block bg-gradient-to-l from-brand to-magic text-white rounded-2xl px-10 py-4 text-xl font-display font-semibold hover:scale-105 transition-all shadow-2xl shadow-magic/30 active:scale-100"
          >
            ✨ התחילי חינם — 2 חוברות מתנה
          </button>

          {/* ── Compact hero login card ── */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-4 max-w-xs mx-auto w-full">
            {heroSent ? (
              <div className="text-center space-y-1.5 py-1">
                <p className="text-white font-semibold text-sm">✉️ בדוק את {heroEmail}</p>
                <p className="text-white/50 text-xs">שלחנו קישור — לחץ עליו להיכנס</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-white/40 text-xs text-center">── כניסה מהירה ──</p>
                <button
                  onClick={signInWithGoogle}
                  disabled={heroLoading || loading}
                  className="w-full flex items-center justify-center gap-2.5 bg-white/90 hover:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold text-ink/80 transition-all disabled:opacity-50"
                >
                  <GoogleIcon />
                  כניסה עם Google
                </button>
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t border-white/15" />
                  <span className="text-white/30 text-xs">או</span>
                  <div className="flex-1 border-t border-white/15" />
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/35 outline-none focus:border-white/50 transition-colors text-right"
                    placeholder="your@email.com"
                    type="email"
                    value={heroEmail}
                    onChange={(e) => setHeroEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendFromHero()}
                    disabled={heroLoading}
                    dir="ltr"
                  />
                  <button
                    onClick={sendFromHero}
                    disabled={heroLoading || !heroEmail.trim()}
                    className="flex-shrink-0 bg-brand hover:opacity-90 text-white rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
                  >
                    {heroLoading ? "…" : "שלחי →"}
                  </button>
                </div>
                {heroError && <p className="text-red-300 text-xs text-center">{heroError}</p>}
              </div>
            )}
          </div>

          <p className="text-xs text-white/30">ללא כרטיס אשראי · ללא סיסמה · כניסה קלה במייל</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="w-1.5 h-1.5 bg-grow rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs text-white/35">
              עכשיו נוצרת חוברת{" "}
              <span
                style={{ transition: "opacity 0.28s ease", opacity: subjectVisible ? 1 : 0 }}
                className="text-brand font-semibold"
              >
                {SUBJECTS[subjectIdx]}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Booklet Preview ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">כך נראית החוברת שנוצרת</h2>
            <p className="text-ink/50 text-sm">לא דפי עבודה משעממים — <strong className="text-magic">משימות חווייתיות שהילד רוצה לסיים</strong></p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Booklet mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-magic/10 to-brand/10 rounded-3xl blur-2xl -z-10 scale-95" />
              <div className="bg-white rounded-2xl shadow-2xl p-6 border border-ink/8 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                {/* Header */}
                <div className="bg-gradient-to-l from-violet-100 to-blue-50 rounded-xl p-4 mb-4 border-2 border-dashed border-violet-300 text-center">
                  <div className="text-xs font-bold text-violet-700 mb-1 tracking-wide">🕵️ תיק משימה סודי</div>
                  <div className="text-base font-bold text-ink">משימה: הצל את ספינת החלל!</div>
                  <div className="flex justify-center gap-3 mt-1.5 text-[10px] text-ink/50">
                    <span>⚠️ סכנה: מנוע ראשי כבוי</span>
                    <span>·</span>
                    <span>🏆 פרס: החזרה הביתה</span>
                  </div>
                </div>
                {/* Problem */}
                <p className="text-xs text-ink/70 mb-3 leading-relaxed font-medium">
                  ⚡ שלב 1 מתוך 5 — חשב את כל המשוואות כדי להפעיל את המנוע:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {["7 × 8 = ___", "6 × 9 = ___", "48 ÷ 6 = ___", "63 ÷ 7 = ___"].map(eq => (
                    <div key={eq} className="bg-canvas rounded-lg p-2 text-center text-xs font-mono border border-ink/8 text-ink/80">{eq}</div>
                  ))}
                </div>
                {/* Color by answer */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-[10px] font-bold text-amber-800 mb-1.5 text-center">🎨 צבע לפי התשובה שלך:</div>
                  <div className="flex justify-center gap-3 text-[10px] text-amber-700">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />56 = כחול</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />54 = צהוב</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />8 = אדום</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" />9 = ירוק</span>
                  </div>
                </div>
              </div>
              {/* Badge */}
              <div className="absolute -bottom-3 -right-2 bg-grow text-white rounded-xl shadow-lg px-3 py-1.5 flex items-center gap-1.5">
                <span className="text-xs font-bold">⚡ נוצר ב-58 שניות</span>
              </div>
            </div>
            {/* Benefits list */}
            <div className="space-y-5">
              {[
                { icon: "🎯", title: "משימה חווייתית", desc: "לא תרגילים יבשים — סיפור שהילד רוצה לסיים. הוא לא מרגיש שהוא לומד — הוא חוקר, מציל, בונה.", color: "bg-magic/10" },
                { icon: "⚽", title: "בעולם שהילד אוהב", desc: "חלל, כדורגל, גיימינג, בישול, פוקמון — הגדרה אחת ובשבילי בונה סביבה שמדברת אליו.", color: "bg-brand/10" },
                { icon: "🎨", title: "צבוע לפי תשובה", desc: "פעילויות יצירתיות שמגבירות מוטיבציה. הילד מצייר ופותר בו-זמנית — ועושה בדיקה עצמית.", color: "bg-amber-50" },
                { icon: "📐", title: "מותאם בדיוק לרמה", desc: "בסיסי, בינוני, מתקדם — ה-AI כותב לרמה שציינת. אף פעם לא קל מדי, אף פעם לא קשה מדי.", color: "bg-grow/10" },
              ].map(({ icon, title, desc, color }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-2xl flex-shrink-0 border border-ink/5`}>{icon}</div>
                  <div>
                    <div className="font-semibold text-ink text-sm">{title}</div>
                    <div className="text-xs text-ink/55 mt-0.5 leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => goToLoginForm("booklet_preview")}
                className="inline-flex items-center gap-2 bg-gradient-to-l from-brand to-magic text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow-md mt-2"
              >
                <span>✨ רוצי לראות חוברת אמיתית?</span>
                <span className="text-white/60 text-xs font-normal">חינם, 60 שניות</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live activity ticker ── */}
      <div className="bg-ink/97 py-2.5 overflow-hidden border-b border-white/5">
        <div className="flex gap-14 whitespace-nowrap animate-ticker">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="text-white/35 text-xs flex-shrink-0">{item}</span>
          ))}
        </div>
      </div>

      {/* ── For whom ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">בנויה עבור אנשי חינוך</h2>
          <p className="text-ink/50 mb-10 text-sm">מורה פרטית, מחנכת, או הורה שרוצה לעזור — בשבילי עובדת בשבילך</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { Icon: IconTeacher, title: "מורה פרטית", desc: "חוברת ייחודית לכל תלמיד, בדיוק לפי הקשיים שלו. לא עוד שעות הכנה — 60 שניות במקום שעה", bg: "bg-gradient-to-br from-magic/15 to-magic/5", border: "border-magic/30", highlight: true },
              { Icon: IconClass, title: "מחנכת כיתה", desc: "מבחן חצי שנתי, חוברת חזרה לפני בחינה, חוברת העשרה — לכל הכיתה בכמה לחיצות", bg: "bg-gradient-to-br from-grow/10 to-grow/5", border: "border-grow/20" },
              { Icon: IconParent, title: "הורה", desc: "תרגול בעולם שהילד אוהב — כדורגל, גיימינג, חיות. לומד בלי להרגיש שהוא לומד", bg: "bg-gradient-to-br from-brand/10 to-brand/5", border: "border-brand/20" },
            ].map(({ Icon, title, desc, bg, border, highlight }) => (
              <div key={title} className={`${bg} rounded-2xl p-6 text-center border ${border} shadow-sm ${highlight ? "ring-2 ring-magic/20 shadow-magic/10" : ""}`}>
                {highlight && <div className="text-xs font-bold text-magic bg-magic/10 rounded-full px-3 py-1 inline-block mb-3">הכי פופולרי ⭐</div>}
                <div className="flex justify-center mb-3"><Icon size={44} /></div>
                <h3 className="font-bold text-ink mb-2 font-display">{title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROI strip ── */}
      <section className="py-8 px-5 bg-gradient-to-l from-magic/10 to-brand/10 border-y border-magic/10">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { num: "3+", label: "שעות חינם בשבוע", sub: "שחוסכת מורה פרטית" },
              { num: "60″", label: "זמן יצירת חוברת", sub: "במקום שעה של הכנה" },
              { num: "₪3", label: "עלות לחוברת", sub: "בתוכנית מורה" },
            ].map(({ num, label, sub }) => (
              <div key={label}>
                <div className="text-2xl sm:text-3xl font-bold text-magic font-display">{num}</div>
                <div className="text-xs sm:text-sm font-semibold text-ink mt-0.5">{label}</div>
                <div className="text-xs text-ink/40 mt-0.5 hidden sm:block">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-14 px-5 bg-canvas">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">איך זה עובד?</h2>
          <p className="text-ink/50 mb-10 text-sm">3 שלבים פשוטים — תוך פחות מדקה</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { num: "01", Icon: IconWrite, title: "בחרי תלמיד ונושא", desc: "שם, כיתה, העולם האהוב, יעד פדגוגי — או פשוט כתבי מה תרצי בחופשיות" },
              { num: "02", Icon: IconSpark, title: "AI יוצר תוך 60 שניות", desc: "חוברת עבודה מלאה עם תרגילים, עמודים ומפתח תשובות — הכל בעברית, מותאם לרמת הילד" },
              { num: "03", Icon: IconPrint, title: "הדפיסי ומסרי", desc: "לחצי הדפס ← שמרי כ-PDF — קובץ A4 מוכן, כיתה של 30 ילדים תוך 3 דקות" },
            ].map(({ num, Icon, title, desc }) => (
              <div key={num} className="relative bg-white rounded-2xl p-6 border border-ink/5 shadow-sm">
                <div className="absolute -top-3 right-4 text-xs font-bold text-white bg-gradient-to-l from-brand to-magic rounded-full px-2.5 py-1">{num}</div>
                <div className="flex justify-center mb-3 mt-2"><Icon size={40} /></div>
                <h3 className="font-bold text-ink mb-2">{title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-14 px-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">מה מקבלים?</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "🎯", title: "אישי לכל תלמיד", desc: "לפי שם, כיתה, עולם תוכן וקשיים ספציפיים" },
              { icon: "📄", title: "1–20 עמודים", desc: "שער אישי, תרגילים, חשיבה, רפלקציה ומפתח" },
              { icon: "👥", title: "ניהול תלמידים", desc: "שמרי פרופיל לכל תלמיד — הגדרות נשמרות" },
              { icon: "☁️", title: "ארכיון בענן", desc: "כל החוברות שיצרת — גישה מכל מכשיר" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-canvas rounded-2xl p-4 text-center border border-ink/5">
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-semibold text-sm text-ink mb-1">{title}</div>
                <div className="text-xs text-ink/50">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Jewish Studies section ── */}
      <section className="py-14 px-5 bg-gradient-to-b from-canvas to-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-magic/10 border border-magic/20 rounded-full px-4 py-1.5 mb-4">
              <span className="text-sm">✡️</span>
              <span className="text-xs font-semibold text-magic">חדש — מקצועות יהדות</span>
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">חומרי יהדות לפי תכנית המפמ\"ר</h2>
            <p className="text-ink/55 text-sm max-w-lg mx-auto leading-relaxed">
              מורות לחינוך דתי לאומי — עכשיו אפשר ליצור דפי עבודה, מבחנים וסיכומים בכל מקצועות היהדות,
              מותאמים לתכנית הלימודים הרשמית של משרד החינוך.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: "⚖️", label: "הלכה",         desc: "ל\"ט מלאכות, ברכות, כשרות — לפי כיתה" },
              { icon: "📜", label: "משנה",          desc: "תענית, ראש השנה, ברכות, אבות — שלמות" },
              { icon: "📖", label: "תנ\"ך",          desc: "חמ\"ד — בראשית עד כתובים לפי שכבה" },
              { icon: "🕍", label: "מקור חיים",     desc: "הרב חיים דוד הלוי — כיתות ז-ט" },
              { icon: "✡️", label: "פרשת השבוע",   desc: "פרשה שוטפת + רש\"י + שאלות עיון" },
              { icon: "🔯", label: "מחשבת ישראל",  desc: "אמונה, ציונות דתית, תורה שבע\"פ" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-magic/10 shadow-sm">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-bold text-sm text-ink mb-1">{label}</div>
                <div className="text-[11px] text-ink/50 leading-snug">{desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-l from-magic/10 to-brand/10 border border-magic/20 rounded-2xl px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { icon: "📄", label: "דף עבודה" },
                { icon: "📝", label: "מבחן 100 נק'" },
                { icon: "📋", label: "סיכום שיעור" },
                { icon: "🃏", label: "כרטיסיות חזרה" },
              ].map(({ icon, label }) => (
                <div key={label} className="bg-white/70 rounded-xl px-3 py-2.5 text-center border border-magic/10">
                  <div className="text-xl mb-1">{icon}</div>
                  <div className="text-[11px] font-semibold text-ink">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-ink/55">
              כל החומרים מותאמים לתכנית הלימודים הרשמית · ציטוטי מקורות מדויקים · עברית תקנית · מוכן להדפסה A4
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-14 px-5 bg-ink">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2 font-display">מה אומרות המורות?</h2>
            <div className="flex items-center justify-center gap-1 mb-1">
              {[1,2,3,4,5].map(s => <span key={s} className="text-brand text-lg">★</span>)}
              <span className="text-white/40 text-sm mr-1.5">4.9 מתוך 5</span>
            </div>
            <p className="text-white/35 text-xs">מתוך 120+ מורות ששתמשו בבשבילי</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(({ initials, name, role, quote, color }) => (
              <div key={name} className="bg-white/6 rounded-2xl p-5 border border-white/10 flex flex-col">
                <div className="text-white/20 text-4xl font-display leading-none mb-2">"</div>
                <p className="text-white/65 text-sm leading-relaxed flex-1">{quote}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className={`w-9 h-9 ${color} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{name}</div>
                    <div className="text-white/35 text-xs">{role}</div>
                  </div>
                  <div className="mr-auto flex gap-0.5">
                    {[1,2,3,4,5].map(s => <span key={s} className="text-brand text-xs">★</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 px-5 bg-canvas">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-ink mb-2 font-display">שאלות שכולם שואלים</h2>
            <p className="text-ink/50 text-sm">כולל השאלה הכי חשובה — למה לא פשוט להשתמש ב-ChatGPT?</p>
          </div>
          <div className="space-y-3">
            {[
              {
                q: "למה לא פשוט להשתמש ב-ChatGPT, Gemini או Claude?",
                a: (
                  <div className="space-y-3">
                    <p>ChatGPT נותן לך <strong>טקסט גולמי</strong> — את עדיין צריכה לעצב אותו, לפרמט, לחשוב על המבנה, ולחזור כמה פעמים עם פרומפטים עד שיצא משהו שאפשר להדפיס. זה לוקח 20-40 דקות.</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="font-bold text-red-600 mb-2">ChatGPT / Gemini</p>
                        <ul className="space-y-1 text-ink/60 text-xs">
                          <li>❌ טקסט בלבד — צריך לעצב בעצמך</li>
                          <li>❌ לא יודע מה לומדים בכיתה ג׳ בישראל</li>
                          <li>❌ צריך לכתוב פרומפט מדויק בכל פעם</li>
                          <li>❌ אין שמירה, ארכיון, או היסטוריה</li>
                          <li>❌ ~20 דקות עד חוברת מוכנה</li>
                        </ul>
                      </div>
                      <div className="bg-grow/5 border border-grow/20 rounded-xl p-3">
                        <p className="font-bold text-grow mb-2">בשבילי</p>
                        <ul className="space-y-1 text-ink/60 text-xs">
                          <li>✅ חוברת מעוצבת, מוכנה להדפסה</li>
                          <li>✅ יודע כיתות, רמות, ותכנית ישראלית</li>
                          <li>✅ 3 שדות ← לחיצה ← מוכן</li>
                          <li>✅ ארכיון בענן לכל החוברות</li>
                          <li>✅ 60 שניות</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-ink/50">בשבילי בנויה על אותה AI (Claude של Anthropic) — אבל הכל מוגדר מראש, מעוצב, ומותאם לצרכים של מורות בישראל.</p>
                  </div>
                ),
              },
              {
                q: "כמה זמן לוקח ליצור חוברת?",
                a: "בממוצע 45-90 שניות מרגע שלחצת 'צור חוברת'. מילוי הטופס לוקח עוד 30 שניות. כלומר — תוך פחות מ-2 דקות יש לך חוברת מוכנה להדפסה.",
              },
              {
                q: "האם צריך ידע טכני או לדעת לכתוב פרומפטים?",
                a: "בכלל לא. בשבילי עובדת עם 3 שדות פשוטים: שם התלמיד, כיתה, ומה תרצי לתרגל. יש גם נושאים מוכנים שאפשר ללחוץ עליהם — הטופס מתמלא אוטומטית.",
              },
              {
                q: "האם החוברת מותאמת לתכנית הלימודים הישראלית?",
                a: "כן. בשבילי יודעת מה לומדים בכל כיתה — חיבור וחיסור בכיתה ב', הכפלה בכיתה ג', שברים בכיתה ד'. אפשר גם לציין רמה (בסיסי / בינוני / מתקדם) ולהתאים לצרכים מיוחדים כמו ADHD, דיסלקציה, או מחוננות.",
              },
              {
                q: "אפשר לערוך את החוברת אחרי שנוצרה?",
                a: "כרגע לא — אבל אפשר ליצור גרסה חדשה עם הנחיות מעודכנות. מורות רבות מוצאות שהחוברת יוצאת כל כך טובה שהן לא צריכות לערוך. אם יש תוספת שרצית — פשוט ציינו אותה בשדה 'הנחיות חופשיות'.",
              },
              {
                q: "האם הנתונים של התלמידים שלי מוגנים?",
                a: "לחלוטין. בשבילי לא שומרת שמות תלמידים אמיתיים — רק את מה שאת מזינה (שם, כיתה, נושא). אנחנו עובדים עם Supabase שמצפין את כל הנתונים ועומד בתקנות GDPR. לא מוכרים נתונים לאף גורם.",
              },
              {
                q: "מה קורה אחרי 3 החוברות החינמיות?",
                a: "האפליקציה תציג הצעה לשדרג. לא נחייב אותך אוטומטית — אין כרטיס אשראי ברירת מחדל. אם תרצי להמשיך, תוכנית מורה עולה ₪59/חודש (20 חוברות) ותוכנית הורה ₪19/חודש (5 חוברות). ביטול בכל עת דרך WhatsApp.",
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-white rounded-2xl border border-ink/8 overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-right px-5 py-4 flex items-center justify-between gap-3 hover:bg-canvas/50 transition-colors"
                >
                  <span className="font-semibold text-ink text-sm leading-snug">{q}</span>
                  <span className={`text-magic flex-shrink-0 text-lg transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-ink/65 leading-relaxed border-t border-ink/5 pt-4">
                    {typeof a === "string" ? <p>{a}</p> : a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-14 px-5 bg-canvas">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-ink mb-2 font-display">מחירים שקופים</h2>
          <p className="text-ink/50 mb-2 text-sm">מתחילים חינם, משדרגים כשרוצים</p>
          <p className="text-xs text-magic/70 font-medium mb-10">מורה פרטית = ₪120/שעה · חוברת בבשבילי = ₪3 · החישוב פשוט 🧮</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Teacher — most prominent, shown first on mobile */}
            <div className="bg-gradient-to-br from-magic/10 to-brand/10 rounded-2xl p-6 border-2 border-magic/40 shadow-float sm:scale-105 text-right relative overflow-hidden flex flex-col order-first sm:order-last">
              <div className="absolute top-3 left-3 bg-magic text-white text-xs rounded-full px-2.5 py-1 font-semibold">מומלץ למורות</div>
              <div className="text-2xl mb-2">🚀 מורה פרטית</div>
              <div className="text-3xl font-bold text-magic mb-1 font-display">₪59<span className="text-sm font-normal text-ink/40">/חודש</span></div>
              <div className="text-xs text-magic/60 font-semibold mb-4">≈ ₪3 לחוברת · 20 שעות הכנה שנחסכות</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5 flex-1">
                {["20 חוברות לחודש", "עד 20 עמודים לחוברת", "מיתוג אישי — לוגו + שם על כל חוברת", "מבחנים רשמיים ללא אימוג'ים", "מפתח תשובות אוטומטי", "ניהול תלמידים + ארכיון בענן", "תמיכה אישית ישירה"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-magic font-bold">✓</span>{f}</li>
                ))}
              </ul>
              <a href={"https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לתוכנית מורה בבשבילי 🚀")}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track("pricing_cta_click", { plan: "teacher", price: 59, dest: "whatsapp" })}
                className="block w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-md">
                💬 שדרגי עכשיו — ₪59
              </a>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-ink/10 shadow-sm text-right">
              <div className="text-2xl mb-2">🌱 חינמי</div>
              <div className="text-3xl font-bold text-ink mb-1 font-display">₪0</div>
              <div className="text-xs text-ink/40 mb-4">לתמיד · ללא כרטיס אשראי</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5">
                {["2 חוברות להתנסות", "עד 2 עמודים", "שמירה בענן"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-grow">✓</span>{f}</li>
                ))}
              </ul>
              <button onClick={() => goToLoginForm("pricing_free")}
                className="block w-full border border-ink/20 text-ink/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:border-magic/40 hover:text-magic transition-colors">
                התחילי חינם ✨
              </button>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-brand/30 shadow-sm text-right">
              <div className="text-2xl mb-2">🌟 הורה</div>
              <div className="text-3xl font-bold text-brand mb-1 font-display">₪19<span className="text-sm font-normal text-ink/40">/חודש</span></div>
              <div className="text-xs text-ink/40 mb-4">ביטול בכל עת</div>
              <ul className="space-y-2 text-sm text-ink/70 mb-5">
                {["5 חוברות לחודש", "עד 10 עמודים", "מפתח תשובות", "שמירה בענן"].map((f) => (
                  <li key={f} className="flex items-center gap-2"><span className="text-brand">✓</span>{f}</li>
                ))}
              </ul>
              <a href={"https://wa.me/972509139137?text=" + encodeURIComponent("שלום! אני רוצה לשדרג לתוכנית הורה בבשבילי 🌟")}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track("pricing_cta_click", { plan: "parent", price: 19, dest: "whatsapp" })}
                className="block w-full bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-semibold text-center hover:opacity-90 transition-opacity shadow-sm">
                💙 שדרגי — ₪19
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Login form ── */}
      <section id="login-form" className="py-16 px-5 bg-white">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center gap-5 flex-wrap mb-6">
              {[
                { icon: "🇮🇱", label: "100% בעברית" },
                { icon: "🔒", label: "פרטיות מוגנת" },
                { icon: "⭐", label: "4.9/5 דירוג" },
                { icon: "✓", label: "ביטול בכל עת" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-ink/35">
                  <span>{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
            <h2 className="text-2xl font-bold text-ink font-display mb-2">מוכנה להתחיל?</h2>
            <p className="text-ink/50">2 חוברות חינם · ללא כרטיס אשראי · 30 שניות הרשמה</p>
          </div>
          <div className="bg-canvas rounded-2xl p-6 border border-ink/10 shadow-sm">
            {step === "verify" ? (
              <div className="space-y-5 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-brand/20 to-magic/20 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-4xl">✉️</span>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-ink text-xl font-display">בדוק את תיבת הדואר</p>
                  <p className="text-ink/50 text-sm">שלחנו קישור כניסה לכתובת:</p>
                  <p className="text-magic font-semibold text-sm break-all">{email}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed text-right">
                  <p><strong>לא מצאת?</strong> בדוק ספאם / קידומי מכירות</p>
                  <p className="mt-1">לחץ על הכפתור בתוך המייל — תיכנס ישירות לאפליקציה ✨</p>
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button onClick={() => { track("auth_change_email_click", {}); setStep("email"); setError(""); }}
                  className="w-full text-sm text-ink/50 hover:text-magic transition-colors border border-ink/15 rounded-xl px-4 py-2.5 hover:border-magic/40">
                  שנה מייל / שלח קישור מחדש
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-ink/60 text-center">כניסה / הרשמה — בלי סיסמה</p>
                <button onClick={signInWithGoogle} disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-ink/20 rounded-xl p-3.5 text-sm font-semibold text-ink/80 hover:border-ink/40 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50">
                  <GoogleIcon />
                  כניסה עם Google
                </button>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-ink/10" />
                  <span className="text-xs text-ink/30">או עם מייל</span>
                  <div className="flex-1 border-t border-ink/10" />
                </div>
                <input
                  className="w-full border border-ink/20 rounded-xl p-3 bg-white text-right outline-none focus:border-magic transition-colors"
                  placeholder="כתובת אימייל"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button onClick={send} disabled={loading || !email.trim()}
                  className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-display font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm">
                  {loading ? "שולח…" : "שלחו לי קישור ✉️"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-canvas border-t border-ink/5 py-8 px-5 text-center text-xs text-ink/25">
        <div className="flex justify-center gap-4 flex-wrap mb-2">
          <a href="https://wa.me/972509139137" target="_blank" rel="noopener noreferrer" onClick={() => track("outbound_click", { dest: "whatsapp_contact" })} className="hover:text-ink/50 transition-colors">צור קשר</a>
          <span>·</span>
          <a href="/privacy.html" target="_blank" onClick={() => track("legal_link_click", { page: "privacy" })} className="hover:text-ink/50 transition-colors">מדיניות פרטיות</a>
          <span>·</span>
          <a href="/terms.html" target="_blank" onClick={() => track("legal_link_click", { page: "terms" })} className="hover:text-ink/50 transition-colors">תנאי שימוש</a>
          <span>·</span>
          <a href="/accessibility.html" target="_blank" onClick={() => track("legal_link_click", { page: "accessibility" })} className="hover:text-ink/50 transition-colors">נגישות</a>
        </div>
        <p>בשבילי © {new Date().getFullYear()} · כל הזכויות שמורות</p>
      </footer>
    </div>
  );
}
