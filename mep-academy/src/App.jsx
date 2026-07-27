import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODULES, getModule } from "./data/modules.js";
import { hasLesson } from "./data/lessonsMeta.js";
import { TOFES4_CHECKLIST } from "./data/tofes4.js";
import { loadState, saveState, clearAllState } from "./lib/storage.js";
import { boolView, setMark, mergeProgress, pruneKeys, sameProgress } from "./lib/progressMerge.js";
import { applyAnswer, bumpMastery, countDue, qid, streakAlive, todayStr, updateStreak } from "./lib/stats.js";
import ModuleView from "./components/ModuleView.jsx";
import Tofes4View from "./components/Tofes4View.jsx";
import ExamView from "./components/ExamView.jsx";
import Landing from "./components/Landing.jsx";
import LoginDialog from "./components/LoginDialog.jsx";
import SearchBox from "./components/SearchBox.jsx";
import Certificate from "./components/Certificate.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { supabase, authAvailable } from "./lib/supabase.js";

// ספריית התקנים נטענת עצל — נדרשת רק כשנכנסים לטאב שלה
const StandardsView = lazy(() => import("./components/StandardsView.jsx"));

const TABS = [
  { id: "home", label: "בית", icon: "🏠" },
  { id: "modules", label: "מודולים", icon: "📚" },
  { id: "standards", label: "תקנים", icon: "📖" },
  { id: "tofes4", label: "טופס 4", icon: "📋" },
  { id: "exam", label: "מבחן", icon: "🎓" },
];

const ALL_QIDS = MODULES.flatMap((m) => m.quiz.map((_, i) => qid(m.id, i)));

// מפתחות לגיטימיים לכל רכיב מסונכרן — כל השאר נגזם במיזוג (ראו pruneKeys)
const MODULE_ID_SET = new Set(MODULES.map((m) => m.id));
const TOFES4_ID_SET = new Set(TOFES4_CHECKLIST.map((c) => c.id));
const QID_SET = new Set(ALL_QIDS);

function pruneAll(data) {
  return {
    ...data,
    completed: pruneKeys(data.completed, MODULE_ID_SET),
    tofes4: pruneKeys(data.tofes4, TOFES4_ID_SET),
    srs: pruneKeys(data.srs, QID_SET),
    mastery: pruneKeys(data.mastery, MODULE_ID_SET),
  };
}

// beforeinstallprompt עלול להישרף לפני שרכיב הבאנר עולה (הדפדפן יורה אותו
// פעם אחת, מוקדם) — נתפס ברמת המודול ונמסר לרכיב דרך אירוע מותאם.
let deferredInstallEvt = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallEvt = e;
    window.dispatchEvent(new Event("mep-install-ready"));
  });
}

function ProgressRing({ done, total, streak }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
      <div
        className="relative w-20 h-20 shrink-0"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`הושלמו ${done} מתוך ${total} מודולים`}
        aria-valuetext={`${pct}%`}
      >
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="16" fill="none" stroke="#F7F6FB" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="#0E7C5F"
            strokeWidth="4"
            strokeDasharray={`${pct} 100`}
            pathLength="100"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-bold font-mono">
          {pct}%
        </span>
      </div>
      <div className="flex-1">
        <p className="font-bold text-lg">ההתקדמות שלך</p>
        <p className="text-ink/70 text-sm">
          הושלמו {done} מתוך {total} מודולים
        </p>
        {streak?.n > 1 && streakAlive(streak) && (
          <p className="mt-1 inline-block bg-brand/15 text-ink rounded-full px-3 py-0.5 text-sm font-semibold">
            🔥 {streak.n} ימי למידה ברצף
          </p>
        )}
      </div>
    </div>
  );
}

function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => !!loadState("installDismissed", false));
  const [installEvt, setInstallEvt] = useState(() => deferredInstallEvt);
  useEffect(() => {
    const onReady = () => setInstallEvt(deferredInstallEvt);
    window.addEventListener("mep-install-ready", onReady);
    return () => window.removeEventListener("mep-install-ready", onReady);
  }, []);

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (dismissed || isStandalone || (!installEvt && !isIos)) return null;

  const dismiss = () => {
    setDismissed(true);
    saveState("installDismissed", true);
  };

  return (
    <div className="bg-magic/10 border border-magic/25 rounded-2xl p-4 flex items-center gap-3">
      <span className="text-2xl shrink-0" aria-hidden>📲</span>
      <div className="flex-1 text-sm leading-relaxed">
        <p className="font-bold">האפליקציה עובדת גם בלי קליטה</p>
        {installEvt ? (
          <p className="text-ink/80">התקינו אותה למסך הבית ולמדו גם באתר, בחניון או בממ"ד.</p>
        ) : (
          <p className="text-ink/80">
            באייפון: לחצו על <span aria-hidden>שיתוף ⬆️</span>
            <span className="sr-only">כפתור שיתוף</span> ואז "הוספה למסך הבית".
          </p>
        )}
      </div>
      {installEvt && (
        <button
          onClick={() => {
            installEvt.prompt();
            setInstallEvt(null);
            dismiss();
          }}
          className="bg-magic text-white rounded-xl px-4 py-2 font-bold shrink-0"
        >
          התקנה
        </button>
      )}
      <button onClick={dismiss} className="text-ink/60 hover:text-ink font-bold px-1 shrink-0">
        ✕<span className="sr-only">סגירת ההצעה</span>
      </button>
    </div>
  );
}

function Home({
  completed,
  bestExam,
  tofes4Done,
  dueCount,
  streak,
  onNavigate,
  onOpenModule,
  onSearchStandards,
  session,
  onLogout,
  onCertificate,
}) {
  const doneCount = MODULES.filter((m) => completed[m.id]).length;
  const nextModule = MODULES.find((m) => !completed[m.id]);
  const certificateReady = doneCount === MODULES.length && (bestExam ?? 0) >= 90;
  const goTo = (tabId) => {
    onNavigate(tabId);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="space-y-4">
      <header className="bg-gradient-to-l from-ink to-steel text-white rounded-2xl p-6">
        <h1 className="font-bold text-3xl mb-2">⚙️ אקדמיית MEP</h1>
        <p className="text-white/85 leading-relaxed">
          קורס דיגיטלי למערכות אלקטרומכניות בבנייה: חשמל, מיזוג, אינסטלציה, בטיחות אש,
          מעליות וגז — עם ספריית תקנים ומסלול הכנה מלא לטופס 4.
        </p>
      </header>

      <SearchBox
        onOpenModule={onOpenModule}
        onGoStandards={onSearchStandards}
        onGoTab={goTo}
      />

      <InstallBanner />

      <ProgressRing done={doneCount} total={MODULES.length} streak={streak} />

      {dueCount > 0 && (
        <button
          onClick={() => goTo("exam")}
          className="w-full bg-white border-2 border-brand/60 rounded-2xl p-4 text-right hover:shadow-md transition flex items-center gap-3"
        >
          <span className="text-3xl shrink-0" aria-hidden>🗓️</span>
          <span className="flex-1">
            <span className="block font-bold">חזרה יומית — {dueCount} שאלות מחכות לך</span>
            <span className="block text-sm text-ink/70">
              חזרה מרווחת קצרה ביום שווה יותר מערב שלם לפני המבחן.
            </span>
          </span>
        </button>
      )}

      {certificateReady ? (
        <button
          onClick={onCertificate}
          className="w-full bg-gradient-to-l from-growdeep to-grow text-white rounded-2xl p-5 text-right hover:opacity-95 transition"
        >
          <p className="font-bold text-lg">🏆 סיימת את הקורס בהצטיינות!</p>
          <p className="text-white/90 text-sm mt-1">לחצו להפקת תעודת סיום — ולשיתוף בוואטסאפ</p>
        </button>
      ) : nextModule ? (
        <button
          onClick={() => onOpenModule(nextModule.id)}
          className="w-full bg-magic text-white rounded-2xl p-5 text-right hover:opacity-90 transition"
        >
          <p className="text-sm text-white/90 mb-1">המודול הבא שלך</p>
          <p className="font-bold text-lg">
            {nextModule.icon} {nextModule.title}
          </p>
        </button>
      ) : (
        <div className="w-full bg-growdeep text-white rounded-2xl p-5 text-center font-bold text-lg">
          🏆 סיימת את כל המודולים! ציון 90% ומעלה במבחן יפתח את תעודת הסיום.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => goTo("tofes4")}
          className="bg-white rounded-2xl shadow-sm p-5 text-right hover:shadow-md transition"
        >
          <p className="text-3xl mb-2" aria-hidden>📋</p>
          <p className="font-bold">הכנה לטופס 4</p>
          <p className="text-sm text-ink/70 font-mono mt-1">
            {tofes4Done}/{TOFES4_CHECKLIST.length} אישורים
          </p>
        </button>
        <button
          onClick={() => goTo("exam")}
          className="bg-white rounded-2xl shadow-sm p-5 text-right hover:shadow-md transition"
        >
          <p className="text-3xl mb-2" aria-hidden>🎓</p>
          <p className="font-bold">מבחן תרגול</p>
          <p className="text-sm text-ink/70 font-mono mt-1">
            {bestExam !== null ? `שיא: ${bestExam}%` : "עוד לא ניגשת"}
          </p>
        </button>
      </div>

      {session && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold">☁️ מחובר — ההתקדמות שלך מסונכרנת</p>
              <p className="text-sm text-ink/70 font-mono" dir="ltr">{session.user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl border border-ink/15 px-4 py-2 font-semibold hover:border-red-400 hover:text-red-700 transition"
            >
              יציאה / החלפת חשבון
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModulesList({ completed, mastery, onOpenModule }) {
  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h1 className="font-bold text-2xl mb-1">📚 מודולי הלימוד</h1>
        <p className="text-white/90">
          {MODULES.length} מודולים לפי סדר הקורס — מהמבוא ועד קו הסיום: טופס 4.
        </p>
      </header>
      <div className="space-y-3">
        {MODULES.map((m, i) => {
          const done = !!completed[m.id];
          const stat = mastery[m.id];
          const answered = stat ? stat.c + stat.w : 0;
          return (
            <button
              key={m.id}
              onClick={() => onOpenModule(m.id)}
              className={`w-full text-right rounded-2xl p-5 transition shadow-sm hover:shadow-md ${
                done ? "bg-grow/10 border border-grow/40" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl shrink-0" aria-hidden>{m.icon}</span>
                <div className="flex-1">
                  <p className="text-xs text-ink/70 font-mono">
                    מודול {i + 1}
                    {hasLesson(m.id) && (
                      <span className="mr-2 text-magic font-sans font-bold">▶️ כולל שיעור</span>
                    )}
                    {answered > 0 && (
                      <span className="mr-2 font-sans">
                        דיוק בתרגול: {Math.round((stat.c / answered) * 100)}%
                      </span>
                    )}
                  </p>
                  <p className="font-bold">{m.title}</p>
                </div>
                {done && (
                  <span className="text-grow text-xl shrink-0">
                    <span aria-hidden>✔️</span>
                    <span className="sr-only">הושלם</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [openModuleId, setOpenModuleId] = useState(null);
  // מפות סימון עם חותמת זמן פר-מפתח (ראו progressMerge.js) — ה-UI מקבל תצוגה בוליאנית
  const [completedMap, setCompletedMap] = useState(() => loadState("completed", {}));
  const [tofes4Map, setTofes4Map] = useState(() => loadState("tofes4", {}));
  // null = עוד לא ניגשו למבחן; 0 הוא ציון אמיתי (0%) ולכן מובחן מ-null.
  // Number.isFinite מסנן ערך פגום שנשמר ידנית ב-storage.
  const [bestExam, setBestExam] = useState(() => {
    const v = loadState("bestExam", null);
    return Number.isFinite(v) ? v : null;
  });
  // למידה מסתגלת: חזרה מרווחת, שליטה פר-מודול ורצף ימים
  const [srs, setSrs] = useState(() => loadState("srs", {}));
  const [mastery, setMastery] = useState(() => loadState("mastery", {}));
  const [streak, setStreak] = useState(() => loadState("streak", null) || null);
  const [standardsQuery, setStandardsQuery] = useState("");
  const [certificateOpen, setCertificateOpen] = useState(false);
  // "היום" כ-state ולא כחישוב-במקום: PWA שנשארת פתוחה ימים חייבת שהחזרה
  // היומית תתעדכן במעבר חצות — מרוענן בחזרה לטאב ובטיימר חצות
  const [today, setToday] = useState(() => todayStr());

  const completed = useMemo(() => boolView(completedMap), [completedMap]);
  const tofes4Checked = useMemo(() => boolView(tofes4Map), [tofes4Map]);

  useEffect(() => saveState("completed", completedMap), [completedMap]);
  useEffect(() => saveState("tofes4", tofes4Map), [tofes4Map]);
  useEffect(() => {
    if (bestExam !== null) saveState("bestExam", bestExam);
  }, [bestExam]);
  useEffect(() => saveState("srs", srs), [srs]);
  useEffect(() => saveState("mastery", mastery), [mastery]);
  useEffect(() => {
    if (streak) saveState("streak", streak);
  }, [streak]);

  // כל תשובה בכל מקום (חידון מודול, מבחן, חזרה יומית) מזינה את שלוש המערכות
  const onAnswer = useCallback((moduleId, questionId, correct) => {
    setMastery((m) => bumpMastery(m, moduleId, correct));
    setSrs((s) => ({ ...s, [questionId]: applyAnswer(s[questionId], correct) }));
    setStreak((s) => updateStreak(s));
  }, []);

  // ---- דף נחיתה, התחברות וסנכרון ענן ----
  // הכניסה לאפליקציה מחייבת חשבון אישי — כך ההתקדמות של כל משתמש
  // נשמרת לו בנפרד ולא מתערבבת עם אחרים באותו מכשיר.
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(authAvailable);
  const [loginOpen, setLoginOpen] = useState(false);
  const cloudReadyRef = useRef(false); // מותר לדחוף לענן רק אחרי משיכה ומיזוג
  const lastUserIdRef = useRef(null);
  const lastSyncRef = useRef(0);
  // טוקן דור לסבבי הסנכרון: כל שינוי מצב / יציאה מהחשבון מבטלים המשך
  // סבב שעדיין באוויר — אחרת מיזוג שחושב מ-snapshot ישן היה דורס שינוי
  // חדש, ואחרי יציאה אף היה מזריק את נתוני המשתמש הקודם למכשיר ריק
  const pushGenRef = useRef(0);
  const [syncTick, setSyncTick] = useState(0); // מאלץ סבב סנכרון (מיזוג ראשון / חזרה לטאב)

  // ניקוי המכשיר — ביציאה יזומה וגם בניתוק חיצוני (פקיעת חיבור, יציאה
  // מלשונית אחרת), כדי שהתקדמות של משתמש אחד לא תדלוף למשתמש הבא.
  const wipeLocal = () => {
    pushGenRef.current++; // סבב סנכרון באוויר לא ישחזר את מה שנמחק
    clearAllState();
    setCompletedMap({});
    setTofes4Map({});
    setBestExam(null);
    setSrs({});
    setMastery({});
    setStreak(null);
    setOpenModuleId(null);
    setTab("home");
    setLoginOpen(false);
  };

  useEffect(() => {
    if (!authAvailable) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        // חיבור שפקע כשהאפליקציה סגורה: לא מוחקים כאן — ייתכן שיש התקדמות
        // אופליין שטרם סונכרנה והבעלים יתחבר שוב. ההכרעה נדחית לרגע
        // ההתחברות: משתמש אחר → ניקוי (בדיקת owner במיזוג), אותו משתמש →
        // ההתקדמות נשמרת ונדחפת לענן שלו. בלי התחברות הנתונים ממילא לא
        // מוצגים (האפליקציה דורשת חשבון).
        setSession(data.session ?? null);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
      const userId = s?.user?.id ?? null;
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        cloudReadyRef.current = false;
        wipeLocal();
      }
      lastUserIdRef.current = userId;
      if (!s) cloudReadyRef.current = false;
    });
    return () => subscription.unsubscribe();
  }, []);

  // בכניסה: מושכים את המצב מהענן וממזגים עם המקומי (מיזוג מונוטוני פר-מפתח —
  // ראו progressMerge.js). לפני המיזוג: אם המצב המקומי שייך למשתמש אחר
  // (מכשיר משותף שהחיבור בו התחלף) — מנקים אותו כדי שלא ידלוף לחשבון הנוכחי.
  useEffect(() => {
    if (!session || cloudReadyRef.current) return;
    const owner = loadState("owner", null);
    if (owner !== session.user.id) {
      // מכשיר משותף: המצב המקומי שייך למשתמש אחר — מנקים לפני המיזוג.
      // גם נתונים ללא רשומת בעלים (גרסה ישנה של האפליקציה) נחשבים זרים —
      // ההתקדמות של בעליהם האמיתיים שמורה בענן שלהם ותשוחזר משם.
      const hasLegacy =
        Object.keys(loadState("completed", {})).length > 0 ||
        Object.keys(loadState("tofes4", {})).length > 0 ||
        loadState("bestExam", null) !== null;
      if (owner || hasLegacy) wipeLocal();
    }
    saveState("owner", session.user.id);
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("mep_progress")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        // משיכה שנכשלה לא נחשבת "ענן ריק": משאירים את הדחיפה נעולה,
        // אחרת שינוי מקומי קטן היה דורס את כל ההתקדמות השמורה בענן.
        if (error) return;
        const remote = pruneAll(data?.data || {});
        setCompletedMap((local) => mergeProgress(remote, { completed: local }).completed);
        setTofes4Map((local) => mergeProgress(remote, { tofes4: local }).tofes4);
        if (Number.isFinite(remote.bestExam))
          setBestExam((local) => Math.max(local ?? 0, remote.bestExam));
        setSrs((local) => mergeProgress(remote, { srs: local }).srs);
        setMastery((local) => mergeProgress(remote, { mastery: local }).mastery);
        setStreak((local) => mergeProgress(remote, { streak: local }).streak);
        cloudReadyRef.current = true;
        lastSyncRef.current = Date.now();
        // דחיפה אחת מיד אחרי המיזוג — מכסה גם ענן ריק מול התקדמות מקומית קיימת
        setSyncTick((t) => t + 1);
      } catch {
        // אין רשת — ננסה שוב בכניסה הבאה; הדחיפה נשארת נעולה
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // חזרה לטאב אחרי זמן ממושך (PWA שנשארת פתוחה ימים): מרעננים מהענן,
  // כדי שהתקדמות שנצברה במכשיר אחר תופיע — והדחיפה הבאה לא תדרוס אותה.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setToday(todayStr()); // מעבר חצות בזמן שהטאב היה ברקע
      if (cloudReadyRef.current && Date.now() - lastSyncRef.current > 10 * 60 * 1000) {
        setSyncTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // מעבר חצות בזמן שהטאב פתוח וגלוי — החזרה היומית מתעדכנת בלי רענון
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const t = setTimeout(() => setToday(todayStr()), midnight.getTime() - now.getTime());
    return () => clearTimeout(t);
  }, [today]);

  // סנכרון לענן (debounce) על כל שינוי — רק אחרי שהמיזוג הראשוני הסתיים.
  // לפני כל דחיפה מושכים את המצב העדכני מהענן וממזגים לתוכו, כך שטאב ישן
  // לעולם לא דורס התקדמות שנעשתה בינתיים במכשיר אחר. התלות היא ב-user id
  // ולא באובייקט session, כדי שרענון טוקן שעתי לא יגרור כתיבה מיותרת.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId || !cloudReadyRef.current) return;
    // כל הרצה של האפקט (= כל שינוי מצב) מבטלת המשך של סבב קודם שבאוויר
    const gen = ++pushGenRef.current;
    const stale = () => gen !== pushGenRef.current || !cloudReadyRef.current;
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("mep_progress")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (stale()) return;
        if (error) return; // בלי מצב ענן אמין — לא דורסים
        // גיזום כפול (ענן ומקומי): שורה שנופחה בזדון עד תקרת ה-64KB לא
        // מזהמת את המכשיר, והדחיפה הבאה מבריאה את השורה בענן
        const remote = pruneAll(data?.data || {});
        const local = pruneAll({ completed: completedMap, tofes4: tofes4Map, bestExam, srs, mastery, streak });
        const merged = mergeProgress(remote, local);
        if (!sameProgress(merged, mergeProgress(remote, {}))) {
          const { error: upsertError } = await supabase.from("mep_progress").upsert({
            user_id: userId,
            data: merged,
            updated_at: new Date().toISOString(),
          });
          // דחיפה שנכשלה (רשת/מגבלת גודל) לא נחשבת סנכרון — הניסיון הבא יחזור עליה
          if (upsertError) return;
          if (stale()) return;
        }
        lastSyncRef.current = Date.now();
        // התקדמות חדשה מהענן (מכשיר אחר) — מוצגת מיד גם כאן
        if (!sameProgress(merged, mergeProgress({}, local))) {
          setCompletedMap(merged.completed);
          setTofes4Map(merged.tofes4);
          setBestExam(merged.bestExam);
          setSrs(merged.srs);
          setMastery(merged.mastery);
          setStreak(merged.streak);
        }
      } catch {
        // אין רשת — הנתונים שמורים מקומית; הדחיפה הבאה תסנכרן
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [completedMap, tofes4Map, bestExam, srs, mastery, streak, userId, syncTick]);

  const signOut = () => {
    pushGenRef.current++; // מבטל סבב סנכרון שבאוויר — לא ישחזר נתונים אחרי היציאה
    cloudReadyRef.current = false;
    supabase?.auth.signOut().catch(() => {});
    // ההתקדמות של המשתמש שיצא שמורה בענן שלו; המכשיר מתחיל נקי.
    wipeLocal();
  };

  // ---- ניווט מודולים עם כפתור Back של הטלפון ----
  const closingModuleRef = useRef(false); // מגן מפני back() כפול בלחיצות מהירות

  const openModule = (id) => {
    setOpenModuleId(id);
    setTab("modules");
    closingModuleRef.current = false;
    // כפתור Back של הטלפון יחזיר לרשימת המודולים — לא יעיף מהאתר
    window.history.pushState({ m: id }, "");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    // רשומת היסטוריה של מודול/שיעור ששרדה רענון עמוד לא משקפת שום UI —
    // מנרמלים אותה כדי ש-Back לא "ייבלע" ולא יפתח מודול ישן במפתיע.
    if (window.history.state?.m || window.history.state?.mepLesson) {
      window.history.replaceState(null, "");
    }
    const onPop = (e) => {
      closingModuleRef.current = false;
      // רשומת שיעור שייכת לנגן (LessonPlayer מטפל בה בעצמו) — לא סוגרים מודול
      if (e.state?.mepLesson) return;
      // Back מחזיר למסך הקודם: רשומה עם מודול — פותחים אותו, אחרת לרשימה
      const m = e.state?.m ?? null;
      setOpenModuleId(m);
      if (m) setTab("modules");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentModule = openModuleId ? getModule(openModuleId) : null;
  const dueCount = useMemo(() => countDue(srs, ALL_QIDS, today), [srs, today]);

  const onFinishExam = useCallback((pct) => {
    setBestExam((b) => Math.max(b ?? 0, pct));
  }, []);

  const goToStandards = (query) => {
    setStandardsQuery(query);
    setTab("standards");
    window.scrollTo({ top: 0 });
  };

  let content = null;
  if (tab === "home") {
    content = (
      <Home
        completed={completed}
        bestExam={bestExam}
        tofes4Done={TOFES4_CHECKLIST.filter((c) => tofes4Checked[c.id]).length}
        dueCount={dueCount}
        streak={streak}
        onNavigate={setTab}
        onOpenModule={openModule}
        onSearchStandards={goToStandards}
        session={session}
        onLogout={signOut}
        onCertificate={() => setCertificateOpen(true)}
      />
    );
  } else if (tab === "modules") {
    content = currentModule ? (
      <ModuleView
        module={currentModule}
        done={!!completed[currentModule.id]}
        onToggleDone={() =>
          setCompletedMap((c) => setMark(c, currentModule.id, !completed[currentModule.id]))
        }
        onAnswer={onAnswer}
        onBack={() => window.history.back()}
      />
    ) : (
      <ModulesList completed={completed} mastery={mastery} onOpenModule={openModule} />
    );
  } else if (tab === "standards") {
    content = (
      <ErrorBoundary>
        <Suspense
          fallback={
            <p role="status" className="text-center text-ink/70 py-10">
              טוען את ספריית התקנים…
            </p>
          }
        >
          <StandardsView initialQuery={standardsQuery} />
        </Suspense>
      </ErrorBoundary>
    );
  } else if (tab === "tofes4") {
    content = (
      <Tofes4View
        checked={tofes4Checked}
        onToggle={(id) => setTofes4Map((c) => setMark(c, id, !tofes4Checked[id]))}
      />
    );
  }

  // בזמן שחזור ההתחברות — מסך פתיחה קצר (מונע הבהוב של דף הנחיתה)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p role="status" className="text-4xl animate-pulse">
          <span aria-hidden>⚙️</span>
          <span className="sr-only">טוען</span>
        </p>
      </div>
    );
  }

  // לא מחובר — דף הנחיתה עם ההרשמה (אין כניסת אורח: לכל אחד המשתמש שלו)
  if (authAvailable && !session) {
    return (
      <>
        {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
        <Landing onLogin={() => setLoginOpen(true)} />
      </>
    );
  }

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg"
      >
        דילוג לתוכן הראשי
      </a>
      {certificateOpen && (
        <Certificate
          session={session}
          bestExam={bestExam}
          onClose={() => setCertificateOpen(false)}
        />
      )}
      <main id="main-content" className="w-full max-w-2xl mx-auto px-4 pt-6 flex-1">
        {content}
        {/* המבחן נשאר תמיד ברכיב חי (מוסתר כשלא בטאב שלו) כדי שמעבר טאב
            בטעות לא ימחק התקדמות של מבחן פעיל */}
        <div hidden={tab !== "exam"}>
          <ExamView
            best={bestExam}
            srs={srs}
            mastery={mastery}
            today={today}
            onFinish={onFinishExam}
            onAnswer={onAnswer}
          />
        </div>
      </main>

      <nav
        aria-label="ניווט ראשי"
        className="fixed bottom-0 inset-x-0 bg-white border-t border-ink/10 shadow-lg"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                // כניסה ישירה לטאב התקנים מתחילה נקייה — בלי שאילתה ישנה
                // שנשארה מחיפוש גלובלי קודם
                if (t.id === "standards") setStandardsQuery("");
                setTab(t.id);
                // מודול פתוח נסגר דרך ההיסטוריה — כך לא נשארת רשומת Back יתומה.
                // closingModuleRef מונע back() כפול בלחיצות מהירות (שהיה מעיף
                // את המשתמש אל מחוץ לאתר) — משוחרר ב-popstate.
                if (openModuleId && !closingModuleRef.current) {
                  closingModuleRef.current = true;
                  window.history.back();
                }
                window.scrollTo({ top: 0 });
              }}
              aria-current={tab === t.id ? "page" : undefined}
              className={`py-3 flex flex-col items-center gap-0.5 text-xs font-semibold transition ${
                tab === t.id ? "text-magic" : "text-ink/70 hover:text-ink"
              }`}
            >
              <span className="text-xl" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <footer className="w-full max-w-2xl mx-auto px-4 mt-auto pt-8 pb-4 text-center text-xs text-ink/70">
        אקדמיית MEP · גרסה {__APP_VERSION__} · התכנים להעשרה מקצועית — אינם תחליף לייעוץ
        הנדסי או לנוסח המחייב של התקנים
      </footer>
    </div>
  );
}
