import { useEffect, useState } from "react";
import { MODULES, getModule } from "./data/modules.js";
import { TOFES4_CHECKLIST } from "./data/tofes4.js";
import { loadState, saveState } from "./lib/storage.js";
import ModuleView from "./components/ModuleView.jsx";
import StandardsView from "./components/StandardsView.jsx";
import Tofes4View from "./components/Tofes4View.jsx";
import ExamView from "./components/ExamView.jsx";

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
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#F7F6FB" strokeWidth="4" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="#1FB58F"
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
        <p className="text-ink/60 text-sm">
          הושלמו {done} מתוך {total} מודולים
        </p>
      </div>
    </div>
  );
}

function Home({ completed, bestExam, tofes4Done, onNavigate, onOpenModule }) {
  const doneCount = MODULES.filter((m) => completed[m.id]).length;
  const nextModule = MODULES.find((m) => !completed[m.id]);
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
          <p className="text-sm text-white/75 mb-1">המודול הבא שלך</p>
          <p className="font-bold text-lg">
            {nextModule.icon} {nextModule.title}
          </p>
        </button>
      ) : (
        <div className="w-full bg-grow text-white rounded-2xl p-5 text-center font-bold text-lg">
          🏆 סיימת את כל המודולים! עכשיו — מבחן.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate("tofes4")}
          className="bg-white rounded-2xl shadow-sm p-5 text-right hover:shadow-md transition"
        >
          <p className="text-3xl mb-2" aria-hidden>📋</p>
          <p className="font-bold">הכנה לטופס 4</p>
          <p className="text-sm text-ink/60 font-mono mt-1">
            {tofes4Done}/{TOFES4_CHECKLIST.length} אישורים
          </p>
        </button>
        <button
          onClick={() => onNavigate("exam")}
          className="bg-white rounded-2xl shadow-sm p-5 text-right hover:shadow-md transition"
        >
          <p className="text-3xl mb-2" aria-hidden>🎓</p>
          <p className="font-bold">מבחן תרגול</p>
          <p className="text-sm text-ink/60 font-mono mt-1">
            {bestExam > 0 ? `שיא: ${bestExam}%` : "עוד לא ניגשת"}
          </p>
        </button>
      </div>
    </div>
  );
}

function ModulesList({ completed, onOpenModule }) {
  return (
    <div className="space-y-4">
      <header className="bg-ink text-white rounded-2xl p-6">
        <h2 className="font-bold text-2xl mb-1">📚 מודולי הלימוד</h2>
        <p className="text-white/85">
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
                  <p className="text-xs text-ink/50 font-mono">מודול {i + 1}</p>
                  <p className="font-bold">{m.title}</p>
                </div>
                {done && <span className="text-grow text-xl shrink-0">✔️</span>}
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
  const [bestExam, setBestExam] = useState(() => loadState("bestExam", 0));

  useEffect(() => saveState("completed", completed), [completed]);
  useEffect(() => saveState("tofes4", tofes4Checked), [tofes4Checked]);
  useEffect(() => saveState("bestExam", bestExam), [bestExam]);

  const openModule = (id) => {
    setOpenModuleId(id);
    setTab("modules");
    window.scrollTo({ top: 0 });
  };

  const currentModule = openModuleId ? getModule(openModuleId) : null;

  let content;
  if (tab === "home") {
    content = (
      <Home
        completed={completed}
        bestExam={bestExam}
        tofes4Done={TOFES4_CHECKLIST.filter((c) => tofes4Checked[c.id]).length}
        onNavigate={setTab}
        onOpenModule={openModule}
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
  } else {
    content = (
      <ExamView best={bestExam} onFinish={(pct) => setBestExam((b) => Math.max(b, pct))} />
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <main className="max-w-2xl mx-auto px-4 pt-6">{content}</main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-ink/10 shadow-lg">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id !== "modules") setOpenModuleId(null);
                window.scrollTo({ top: 0 });
              }}
              className={`py-3 flex flex-col items-center gap-0.5 text-xs font-semibold transition ${
                tab === t.id ? "text-magic" : "text-ink/50 hover:text-ink"
              }`}
            >
              <span className="text-xl" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <footer className="max-w-2xl mx-auto px-4 mt-8 pb-4 text-center text-xs text-ink/40">
        אקדמיית MEP · גרסה {__APP_VERSION__} · התכנים להעשרה מקצועית — אינם תחליף לייעוץ
        הנדסי או לנוסח המחייב של התקנים
      </footer>
    </div>
  );
}
