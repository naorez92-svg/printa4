import { useEffect, useRef, useState } from "react";
import { MODULES, getModule } from "./data/modules.js";
import { getLesson } from "./data/lessons.js";
import { TOFES4_CHECKLIST } from "./data/tofes4.js";
import { loadState, saveState } from "./lib/storage.js";
import ModuleView from "./components/ModuleView.jsx";
import StandardsView from "./components/StandardsView.jsx";
import Tofes4View from "./components/Tofes4View.jsx";
import ExamView from "./components/ExamView.jsx";
import Landing from "./components/Landing.jsx";
import LoginDialog from "./components/LoginDialog.jsx";
import { supabase, authAvailable } from "./lib/supabase.js";

const TABS = [
  { id: "home", label: "בית", icon: "🏠" },
  { id: "modules", label: "מודולים", icon: "📚" },
  { id: "standards", label: "תקנים", icon: "📖" },
  { id: "tofes4", label: "טופס 4", icon: "📋" },
  { id: "exam", label: "מבחן", icon: "🎓" },
];

function ProgressRing({ done, total }) {
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
      <div>
        <p className="font-bold text-lg">ההתקדמות שלך</p>
        <p className="text-ink/70 text-sm">
          הושלמו {done} מתוך {total} מודולים
        </p>
      </div>
    </div>
  );
}

function Home({ completed, bestExam, tofes4Done, onNavigate, onOpenModule, session, onLogin, onLogout }) {
  const doneCount = MODULES.filter((m) => completed[m.id]).length;
  const nextModule = MODULES.find((m) => !completed[m.id]);
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

      <ProgressRing done={doneCount} total={MODULES.length} />

      {nextModule ? (
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
          🏆 סיימת את כל המודולים! עכשיו — מבחן.
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

      {authAvailable && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          {session ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">☁️ מחובר — ההתקדמות מסונכרנת</p>
                <p className="text-sm text-ink/70 font-mono" dir="ltr">{session.user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="rounded-xl border border-ink/15 px-4 py-2 font-semibold hover:border-red-400 hover:text-red-700 transition"
              >
                יציאה
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold">☁️ סנכרון בין מכשירים</p>
                <p className="text-sm text-ink/70">התחברו באימייל — וההתקדמות תישמר בכל מכשיר.</p>
              </div>
              <button
                onClick={onLogin}
                className="rounded-xl bg-magic text-white px-4 py-2 font-bold hover:opacity-90 transition"
              >
                התחברות
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModulesList({ completed, onOpenModule }) {
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
                    {getLesson(m.id) && (
                      <span className="mr-2 text-magic font-sans font-bold">▶️ כולל שיעור</span>
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
  const [completed, setCompleted] = useState(() => loadState("completed", {}));
  const [tofes4Checked, setTofes4Checked] = useState(() => loadState("tofes4", {}));
  // null = עוד לא ניגשו למבחן; 0 הוא ציון אמיתי (0%) ולכן מובחן מ-null.
  // Number.isFinite מסנן ערך פגום שנשמר ידנית ב-storage.
  const [bestExam, setBestExam] = useState(() => {
    const v = loadState("bestExam", null);
    return Number.isFinite(v) ? v : null;
  });

  useEffect(() => saveState("completed", completed), [completed]);
  useEffect(() => saveState("tofes4", tofes4Checked), [tofes4Checked]);
  useEffect(() => {
    if (bestExam !== null) saveState("bestExam", bestExam);
  }, [bestExam]);

  // ---- דף נחיתה, התחברות וסנכרון ענן ----
  const [entered, setEntered] = useState(() => loadState("entered", false));
  const [session, setSession] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const cloudReadyRef = useRef(false); // מותר לדחוף לענן רק אחרי משיכה ומיזוג

  useEffect(() => saveState("entered", entered), [entered]);

  useEffect(() => {
    if (!authAvailable) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) cloudReadyRef.current = false;
    });
    return () => subscription.unsubscribe();
  }, []);

  // מי שמחובר — עבר את דף הנחיתה
  useEffect(() => {
    if (session) setEntered(true);
  }, [session]);

  // בכניסה: מושכים את המצב מהענן וממזגים עם המקומי (איחוד השלמות, שיא מקסימלי)
  useEffect(() => {
    if (!session || cloudReadyRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("mep_progress")
          .select("data")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        const remote = data?.data || {};
        if (remote.completed) setCompleted((local) => ({ ...remote.completed, ...local }));
        if (remote.tofes4) setTofes4Checked((local) => ({ ...remote.tofes4, ...local }));
        if (Number.isFinite(remote.bestExam))
          setBestExam((local) => Math.max(local ?? 0, remote.bestExam));
      } catch {
        // אין רשת / טבלה עוד לא קיימת — ממשיכים מקומית, ננסה שוב בכניסה הבאה
      }
      cloudReadyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // דחיפה לענן (debounce) על כל שינוי — רק אחרי שהמיזוג הראשוני הסתיים
  useEffect(() => {
    if (!session || !cloudReadyRef.current) return;
    const t = setTimeout(() => {
      supabase
        .from("mep_progress")
        .upsert({
          user_id: session.user.id,
          data: { completed, tofes4: tofes4Checked, bestExam },
          updated_at: new Date().toISOString(),
        })
        .then(() => {}, () => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [completed, tofes4Checked, bestExam, session]);

  const signOut = () => {
    cloudReadyRef.current = false;
    supabase?.auth.signOut();
  };

  const openModule = (id) => {
    setOpenModuleId(id);
    setTab("modules");
    // כפתור Back של הטלפון יחזיר לרשימת המודולים — לא יעיף מהאתר
    window.history.pushState({ m: id }, "");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPop = (e) => {
      // אם המצב שנחשף הוא מודול (סגרנו שיעור) — נשארים בו; אחרת חוזרים לרשימה
      if (!e.state?.m) setOpenModuleId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const currentModule = openModuleId ? getModule(openModuleId) : null;

  let content = null;
  if (tab === "home") {
    content = (
      <Home
        completed={completed}
        bestExam={bestExam}
        tofes4Done={TOFES4_CHECKLIST.filter((c) => tofes4Checked[c.id]).length}
        onNavigate={setTab}
        onOpenModule={openModule}
        session={session}
        onLogin={() => setLoginOpen(true)}
        onLogout={signOut}
      />
    );
  } else if (tab === "modules") {
    content = currentModule ? (
      <ModuleView
        module={currentModule}
        done={!!completed[currentModule.id]}
        onToggleDone={() =>
          setCompleted((c) => ({ ...c, [currentModule.id]: !c[currentModule.id] }))
        }
        onBack={() => setOpenModuleId(null)}
      />
    ) : (
      <ModulesList completed={completed} onOpenModule={openModule} />
    );
  } else if (tab === "standards") {
    content = <StandardsView />;
  } else if (tab === "tofes4") {
    content = (
      <Tofes4View
        checked={tofes4Checked}
        onToggle={(id) => setTofes4Checked((c) => ({ ...c, [id]: !c[id] }))}
      />
    );
  }

  // מבקר חדש (לא נכנס ולא מחובר) — דף הנחיתה
  if (!entered && !session) {
    return (
      <>
        {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
        <Landing onStart={() => setEntered(true)} onLogin={() => setLoginOpen(true)} />
      </>
    );
  }

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg"
      >
        דילוג לתוכן הראשי
      </a>
      <main id="main-content" className="w-full max-w-2xl mx-auto px-4 pt-6 flex-1">
        {content}
        {/* המבחן נשאר תמיד ברכיב חי (מוסתר כשלא בטאב שלו) כדי שמעבר טאב
            בטעות לא ימחק התקדמות של מבחן פעיל */}
        <div hidden={tab !== "exam"}>
          <ExamView
            best={bestExam}
            onFinish={(pct) => setBestExam((b) => Math.max(b ?? 0, pct))}
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
                setTab(t.id);
                setOpenModuleId(null);
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
