import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import Create from "../components/Create";
import History from "../components/History";
import UpgradeModal from "../components/UpgradeModal";
import FeedbackWidget from "../components/FeedbackWidget";
import OnboardingModal from "../components/OnboardingModal";
import { useProfile, FREE_LIMIT } from "../hooks/useProfile";
import InstallPWA from "../components/InstallPWA";
import Logo from "../components/Logo";
import { track } from "../hooks/useEvents";

// Tab-gated, on-demand chunks — only fetched when the user opens that tab.
// AdminPanel (admin-only, ~64KB) and the create flows are the heaviest parts of
// the app, and most users never open them, so they don't belong in the first load.
const Students = lazy(() => import("../components/Students"));
const AdminPanel = lazy(() => import("../components/AdminPanel"));
const BrandingSettings = lazy(() => import("../components/BrandingSettings"));
const JewishCreate = lazy(() => import("../components/JewishCreate"));

const NAV = [
  ["create",   "✨", "צור חוברת"],
  ["jewish",   "✡️", "יהדות"],
  ["students", "👥", "תלמידים"],
  ["history",  "📂", "החוברות שלי"],
];

function QuotaBar({ loading, isPro, monthlyBookletCount, monthlyLimit, bookletCount, className = "" }) {
  if (loading) return null;
  return (
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
  );
}

export default function Dashboard() {
  const [tab, setTab]             = useState("create");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingStarter, setPendingStarter] = useState(null);
  const [onboarded, setOnboarded] = useState(() => {
    try { return !!localStorage.getItem("beshvili_onboarded"); } catch { return true; }
  });
  const finishOnboarding = () => {
    try { localStorage.setItem("beshvili_onboarded", "1"); } catch {}
    setOnboarded(true);
  };
  const { profile, plan, bookletCount, monthlyBookletCount, monthlyLimit, remaining, isPro, isAdmin, loading, refresh } = useProfile();

  const prevBookletCountRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    if (prevBookletCountRef.current === null) { prevBookletCountRef.current = bookletCount; return; }
    if (!isPro && bookletCount > prevBookletCountRef.current && remaining === 1) {
      prevBookletCountRef.current = bookletCount;
      const t = setTimeout(() => setShowUpgrade(true), 1800);
      return () => clearTimeout(t);
    }
    prevBookletCountRef.current = bookletCount;
  }, [bookletCount, remaining, isPro, loading]);

  const tabs = [
    ...NAV,
    ...(isPro ? [["branding", "🎨", "מיתוג"]] : []),
    ...(isAdmin ? [["admin", "🔐", "ניהול"]] : []),
  ];

  return (
    <div className="min-h-screen bg-canvas" dir="rtl">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col fixed right-0 top-0 h-screen w-60 bg-ink z-20 shadow-xl">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Logo size={30} />
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

        {/* Quota + install + sign out */}
        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <QuotaBar loading={loading} isPro={isPro} monthlyBookletCount={monthlyBookletCount} monthlyLimit={monthlyLimit} bookletCount={bookletCount} />
          {!loading && bookletCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-grow font-medium">
              <span>⏱</span>
              <span>חסכת ~{bookletCount * 45 >= 60 ? `${(bookletCount * 45 / 60).toFixed(1).replace(".0","")} שעות` : `${bookletCount * 45} דק'`} הכנה</span>
            </div>
          )}
          <InstallPWA variant="sidebar" />
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
            <Logo size={24} />
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
                {remaining > 0 ? `נותרו ${remaining} חינם ✨` : "שדרגי לפרו ↑"}
              </button>
            ))}
            <button onClick={() => supabase.auth.signOut()}
              className="text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1.5">
              יציאה
            </button>
          </div>
        </div>
        <QuotaBar loading={loading} isPro={isPro} monthlyBookletCount={monthlyBookletCount} monthlyLimit={monthlyLimit} bookletCount={bookletCount} className="px-4 pb-2" />
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
          {/* First-time welcome nudge — mirrors landing page promise */}
          {tab === "create" && !loading && !isPro && bookletCount === 0 && (
            <div className="bg-gradient-to-l from-magic/10 to-brand/10 border border-magic/20 rounded-2xl px-5 py-4 mb-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">🎁</span>
                <div className="flex-1">
                  <p className="font-semibold text-ink text-sm">ברוכה הבאה! 2 חוברות חינמיות מחכות לך</p>
                  <p className="text-xs text-ink/55 mt-0.5 leading-relaxed">
                    מורות פרטיות חוסכות <strong className="text-magic">3+ שעות הכנה בשבוע</strong> עם בשבילי — כל חוברת מוכנה ב-60 שניות במקום שעה
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/60 rounded-full px-2.5 py-1 text-[10px] text-ink/60">
                  <span className="w-1.5 h-1.5 bg-grow rounded-full" />
                  120+ מורות כבר חוסכות זמן
                </div>
                <div className="flex items-center gap-1.5 bg-white/60 rounded-full px-2.5 py-1 text-[10px] text-ink/60">
                  <span>⚡</span>
                  60 שניות לחוברת מלאה
                </div>
                <div className="flex items-center gap-1.5 bg-white/60 rounded-full px-2.5 py-1 text-[10px] text-ink/60">
                  <span>💸</span>
                  ₪3 לחוברת בתוכנית מורה
                </div>
              </div>
            </div>
          )}

          {/* Quota progress card — shown after first booklet to drive conversion */}
          {tab === "create" && !loading && !isPro && bookletCount > 0 && remaining > 0 && (
            <div className="bg-white border border-ink/8 rounded-2xl px-5 py-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink/60">חוברות חינמיות שנוצלו</span>
                <span className="text-xs font-bold text-ink">{bookletCount} / {FREE_LIMIT}</span>
              </div>
              <div className="w-full h-2 bg-canvas rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${remaining === 1 ? "bg-gradient-to-l from-red-400 to-orange-400" : "bg-gradient-to-l from-brand to-magic"}`}
                  style={{ width: `${Math.min(100, (bookletCount / FREE_LIMIT) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-ink/50">
                  {remaining === 1
                    ? "⚠️ נשארה לך חוברת חינמית אחת בלבד"
                    : `נותרו לך ${remaining} חוברות חינמיות`}
                </p>
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="flex-shrink-0 text-xs bg-gradient-to-l from-brand to-magic text-white rounded-xl px-3 py-1.5 font-semibold hover:opacity-90 transition-opacity"
                >
                  שדרגי לפרו ✨
                </button>
              </div>
            </div>
          )}

          {/* Create stays mounted (and OUTSIDE the Suspense boundary below) to
              preserve in-progress generation when switching tabs — a sibling lazy
              chunk suspending must never unmount it. */}
          <div className={tab === "create" ? "" : "hidden"}>
            <Create active={tab === "create"} onSaved={() => refresh()} remaining={remaining} isPro={isPro} bookletCount={bookletCount} onUpgrade={() => setShowUpgrade(true)}
              pendingStarter={pendingStarter} onStarterConsumed={() => setPendingStarter(null)} />
          </div>
          {tab === "history" && <History isPro={isPro} onUpgrade={() => setShowUpgrade(true)} />}
          <Suspense fallback={<div className="py-12 text-center text-ink/40 text-sm">טוען…</div>}>
            {tab === "jewish" && <JewishCreate onSaved={() => refresh()} remaining={remaining} isPro={isPro} bookletCount={bookletCount} onUpgrade={() => setShowUpgrade(true)} />}
            {tab === "students" && <Students onBookletSaved={() => { refresh(); setTab("history"); }} remaining={remaining} isPro={isPro} bookletCount={bookletCount} />}
            {tab === "branding" && isPro && <BrandingSettings profile={profile} onSaved={refresh} />}
            {tab === "admin" && isAdmin && <AdminPanel />}
          </Suspense>
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

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} bookletCount={bookletCount} source="dashboard" />}
      {!loading && !isPro && bookletCount === 0 && !onboarded && tab === "create" && (
        <OnboardingModal
          onPick={(s) => { setPendingStarter(s); finishOnboarding(); track("onboarding_starter_picked", { label: s.label }); }}
          onSkip={() => { finishOnboarding(); track("onboarding_skipped", {}); }}
        />
      )}
      <FeedbackWidget />
      <InstallPWA variant="banner" />
    </div>
  );
}
