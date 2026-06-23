import { useState } from "react";
import { supabase } from "../lib/supabase";
import Create from "../components/Create";
import History from "../components/History";
import Students from "../components/Students";
import UpgradeModal from "../components/UpgradeModal";
import FeedbackWidget from "../components/FeedbackWidget";
import AdminPanel from "../components/AdminPanel";
import { useProfile, FREE_LIMIT } from "../hooks/useProfile";

export default function Dashboard() {
  const [tab, setTab]             = useState("create");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { profile, plan, bookletCount, monthlyBookletCount, monthlyLimit, remaining, isPro, isAdmin, loading, refresh } = useProfile();

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-ink/5">
        <div className="max-w-2xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="font-bold text-ink text-lg font-display">בשבילי<span className="text-brand">·</span></span>
          </div>

          <div className="flex items-center gap-3">
            {/* Plan badge */}
            {!loading && (
              isPro ? (
                <span className="text-xs font-semibold bg-magic/10 text-magic border border-magic/30 rounded-full px-2.5 py-1">
                  ✓ {plan === "teacher" || plan === "pro" ? "מורה" : plan === "parent" ? "הורה" : "פרו"}
                </span>
              ) : (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="text-xs font-medium text-ink/50 bg-canvas border border-ink/10 rounded-full px-2.5 py-1 hover:border-magic/40 hover:text-magic transition-colors"
                >
                  {remaining}/{FREE_LIMIT} חינם ↑
                </button>
              )
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-ink/40 hover:text-ink/70 transition-colors border border-ink/10 rounded-lg px-3 py-1.5"
            >
              יציאה
            </button>
          </div>
        </div>

        {/* Quota bar */}
        {!loading && (
          <div className="max-w-2xl mx-auto px-5 pb-2">
            {isPro && monthlyLimit ? (
              <div className="flex items-center gap-2 text-xs text-ink/50">
                <div className="flex-1 h-1 bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${monthlyBookletCount >= monthlyLimit ? "bg-amber-400" : "bg-magic"}`}
                    style={{ width: `${Math.min(100, (monthlyBookletCount / monthlyLimit) * 100)}%` }}
                  />
                </div>
                <span>{monthlyBookletCount}/{monthlyLimit} חוברות החודש</span>
              </div>
            ) : !isPro ? (
              <div className="flex items-center gap-2 text-xs text-ink/50">
                <div className="flex-1 h-1 bg-ink/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${bookletCount >= FREE_LIMIT ? "bg-red-400" : "bg-brand"}`}
                    style={{ width: `${Math.min(100, (bookletCount / FREE_LIMIT) * 100)}%` }}
                  />
                </div>
                <span>{bookletCount}/{FREE_LIMIT} חוברות חינם</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-5 pb-3 flex gap-1">
          {[["create", "✨ צור חוברת"], ["students", "👥 תלמידים"], ["history", "📂 החוברות שלי"], ...(isAdmin ? [["admin", "🔐 ניהול"]] : [])].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === id ? "bg-magic text-white shadow-sm" : "text-ink/50 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        {tab === "create" && (
          <Create
            onSaved={() => { refresh(); }}
            remaining={remaining}
            isPro={isPro}
          />
        )}
        {tab === "students" && (
          <Students
            onBookletSaved={() => { refresh(); setTab("history"); }}
            remaining={remaining}
            isPro={isPro}
          />
        )}
        {tab === "history" && <History />}
        {tab === "admin" && isAdmin && <AdminPanel />}
      </main>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      <FeedbackWidget />

      <footer className="max-w-2xl mx-auto px-5 py-6 border-t border-ink/5 text-center text-xs text-ink/25 space-y-1">
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
  );
}
