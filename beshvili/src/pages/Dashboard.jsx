import { useState } from "react";
import { supabase } from "../lib/supabase";
import Create from "../components/Create";
import History from "../components/History";
import Students from "../components/Students";
import UpgradeModal from "../components/UpgradeModal";
import FeedbackWidget from "../components/FeedbackWidget";
import AdminPanel from "../components/AdminPanel";
import { useProfile, FREE_LIMIT } from "../hooks/useProfile";

const NAV = [
  ["create",   "✨", "צור חוברת"],
  ["students", "👥", "תלמידים"],
  ["history",  "📂", "החוברות שלי"],
];

export default function Dashboard() {
  const [tab, setTab]             = useState("create");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { profile, plan, bookletCount, monthlyBookletCount, monthlyLimit, remaining, isPro, isAdmin, loading, refresh } = useProfile();

  const tabs = [...NAV, ...(isAdmin ? [["admin", "🔐", "ניהול"]] : [])];

  const QuotaBar = ({ className = "" }) => !loading ? (
    <div className={`flex items-center gap-2 text-xs text-white/40 ${className}`}>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        {isPro && monthlyLimit ? (
          <div className={`h-full rounded-full transition-all ${monthlyBookletCount >= monthlyLimit ? "bg-amber-400" : "bg-magic"}`}
            style={{ width: `${Math.min(100, (monthlyBookletCount / monthlyLimit) * 100)}%` }} />
        ) : !isPro ? (
          <div className={`h-full rounded-full transition-all ${bookletCount >= FREE_LIMIT ? "bg-red-400" : "bg-brand"}`}
            style={{ width: `${Math.min(100, (bookletCount / FREE_LIMIT) * 100)}%` }} />
        ) : null}
      </div>
      <span className="whitespace-nowrap">
        {isPro && monthlyLimit ? `${monthlyBookletCount}/${monthlyLimit} החודש` : !isPro ? `${bookletCount}/${FREE_LIMIT} חינם` : ""}
      </span>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-canvas" dir="rtl">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col fixed right-0 top-0 h-screen w-60 bg-ink z-20 shadow-xl">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-white text-xl font-display">בשבילי<span className="text-brand">·</span></span>
          </div>
          {!loading && (
            <div className="mt-3">
              {isPro ? (
                <span className="text-xs font-semibold bg-magic/25 text-magic border border-magic/40 rounded-full px-2.5 py-1">
                  ✓ {plan === "teacher" ? "מורה" : plan === "parent" ? "הורה" : "פרו"}
                </span>
              ) : (
                <button onClick={() => setShowUpgrade(true)}
                  className="text-xs font-medium text-white/60 bg-white/10 border border-white/20 rounded-full px-2.5 py-1 hover:border-brand/60 hover:text-brand transition-colors">
                  שדרג לפרו ↑
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-right ${
                tab === id ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/8"
              }`}>
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Quota + sign out */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <QuotaBar />
          <button onClick={() => supabase.auth.signOut()}
            className="w-full text-xs text-white/30 hover:text-white/60 transition-colors text-right">
            יציאה מהחשבון →
          </button>
        </div>
      </aside>

      {/* ── Mobile header ── */}
      <header className="lg:hidden sticky top-0 z-10 bg-ink shadow-md">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <span className="font-bold text-white text-base font-display">בשבילי<span className="text-brand">·</span></span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (isPro ? (
              <span className="text-xs font-semibold bg-magic/25 text-magic border border-magic/40 rounded-full px-2 py-0.5">
                ✓ {plan === "teacher" ? "מורה" : plan === "parent" ? "הורה" : "פרו"}
              </span>
            ) : (
              <button onClick={() => setShowUpgrade(true)}
                className="text-xs text-white/60 bg-white/10 border border-white/20 rounded-full px-2.5 py-1">
                {remaining}/{FREE_LIMIT} ↑
              </button>
            ))}
            <button onClick={() => supabase.auth.signOut()}
              className="text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1.5">
              יציאה
            </button>
          </div>
        </div>
        <QuotaBar className="px-4 pb-2" />
        {/* Mobile tabs */}
        <div className="px-3 pb-2 flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                tab === id ? "bg-white text-ink shadow-sm" : "text-white/50 hover:text-white/80"
              }`}>
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="lg:mr-60">
        <main className="max-w-3xl mx-auto px-5 py-6 lg:py-8">
          {tab === "create" && <Create onSaved={() => refresh()} remaining={remaining} isPro={isPro} />}
          {tab === "students" && <Students onBookletSaved={() => { refresh(); setTab("history"); }} remaining={remaining} isPro={isPro} />}
          {tab === "history" && <History />}
          {tab === "admin" && isAdmin && <AdminPanel />}
        </main>

        <footer className="max-w-3xl mx-auto px-5 py-6 border-t border-ink/5 text-center text-xs text-ink/25 space-y-1">
          <div className="flex justify-center gap-4 flex-wrap">
            <a href="https://wa.me/972509139137" target="_blank" rel="noopener noreferrer" className="hover:text-ink/50 transition-colors">צור קשר</a>
            <span>·</span>
            <a href="/privacy.html" target="_blank" className="hover:text-ink/50 transition-colors">מדיניות פרטיות</a>
            <span>·</span>
            <a href="/terms.html" target="_blank" className="hover:text-ink/50 transition-colors">תנאי שימוש</a>
            <span>·</span>
            <a href="/accessibility.html" target="_blank" className="hover:text-ink/50 transition-colors">נגישות</a>
          </div>
          <p>בשבילי © {new Date().getFullYear()} · כל הזכויות שמורות</p>
        </footer>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      <FeedbackWidget />
    </div>
  );
}
