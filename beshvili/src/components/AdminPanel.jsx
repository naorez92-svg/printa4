import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const fmt     = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "—";
const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

// One enriched user row — shared by the recent-users table and email search.
const renderUserRow = (u) => (
  <tr key={u.id} className="border-b border-ink/5 last:border-0">
    <td className="py-1.5 pr-1 text-ink/70 font-mono">{u.email}</td>
    <td className="py-1.5 pr-1 text-ink/50">
      {fmtDate(u.createdAt)}
      <span className="block text-[9px] text-ink/35">
        {new Date(u.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </td>
    <td className="py-1.5 pr-1">
      {(() => {
        const days = daysSince(u.lastBookletAt);
        if (days === null) return <span className="text-ink/25 text-xs">—</span>;
        if (days === 0)    return <span className="text-grow text-xs font-medium">היום</span>;
        if (days <= 3)    return <span className="text-brand text-xs">{days}י'</span>;
        return <span className="text-red-400 text-xs font-medium">{days}י'</span>;
      })()}
    </td>
    <td className="py-1.5 pr-1">
      <span className={`font-bold ${
        u.bookletCount === 0 ? "text-red-400" :
        u.plan === "free" && u.bookletCount >= 2 ? "text-brand" :
        "text-grow"
      }`}>
        {u.bookletCount}
        {u.plan === "free" && u.bookletCount >= 2 ? " ⚡" : ""}
      </span>
      {/* 0 booklets: distinguish "tried & failed" from "never tried" */}
      {u.bookletCount === 0 && (
        (u.startedCount ?? 0) > 0
          ? <span className="block text-[9px] text-red-500 font-medium" title={`${u.lastErrorType ? `שגיאה: ${u.lastErrorType}` : ""}${u.lastErrorBuild ? ` · v=${u.lastErrorBuild}` : ""}`}>
              ✗ ניסתה {u.startedCount}× {u.lastErrorType && u.lastErrorType !== "quota" ? `(${u.lastErrorType})` : ""}
              {u.lastErrorInapp && <span className="block text-[8px] text-magic">📱 דפדפן מוטמע (פייסבוק/אינסטגרם)</span>}
              {u.lastErrorBuild && <span className="block text-[8px] text-ink/30">v={u.lastErrorBuild}</span>}
            </span>
          : <span className="block text-[9px] text-ink/25">לא ניסתה</span>
      )}
    </td>
    <td className="py-1.5 pr-1">
      <span className={`px-1.5 py-0.5 rounded text-xs ${
        u.plan === "teacher" || u.plan === "pro" ? "bg-magic/10 text-magic" :
        u.plan === "parent"  ? "bg-brand/10 text-brand" :
        u.plan === "admin"   ? "bg-grow/10 text-grow"   :
        "bg-canvas text-ink/40"
      }`}>
        {u.plan === "teacher" ? "מורה" : u.plan === "parent" ? "הורה" : u.plan}
      </span>
    </td>
    <td className="py-1.5 pr-1 text-ink/30">{u.followupSent ? "✓" : "—"}</td>
  </tr>
);

const USER_TABLE_HEAD = (
  <thead>
    <tr className="text-ink/40 border-b border-ink/5">
      <th className="text-right pb-2 pr-1">מייל</th>
      <th className="text-right pb-2 pr-1">הצטרף</th>
      <th className="text-right pb-2 pr-1">יצירה אחרונה</th>
      <th className="text-right pb-2 pr-1">חוברות</th>
      <th className="text-right pb-2 pr-1">תוכנית</th>
      <th className="text-right pb-2 pr-1">פולואפ</th>
    </tr>
  </thead>
);

// P&L constants
const PLAN_PRICE          = { parent: 19, teacher: 59, pro: 30 };
const COST_PER_BOOKLET_NIS = 0.65;
const SUPABASE_MONTHLY_NIS = 0;
const VERCEL_MONTHLY_NIS   = 0;

const AGENT_META = {
  financial: { label: "💰 כלכלי",  bg: "bg-grow/10",   text: "text-grow",   border: "border-grow/30"  },
  product:   { label: "📈 מוצר",   bg: "bg-magic/10",  text: "text-magic",  border: "border-magic/30" },
  health:    { label: "⚕️ בריאות", bg: "bg-brand/10",  text: "text-brand",  border: "border-brand/30" },
};

function ProposalCard({ proposal: p, onAction }) {
  const meta = AGENT_META[p.agent] ?? AGENT_META.health;
  const isWA = p.action_type === "whatsapp";
  return (
    <div className={`bg-white rounded-2xl p-4 border shadow-sm ${meta.border}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
        <h4 className="font-bold text-ink text-sm leading-snug">{p.title}</h4>
      </div>
      <p className="text-xs text-ink/60 mb-3 leading-relaxed">{p.description}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onAction(p.id, "approved", p)}
          className="flex-1 bg-grow text-white rounded-xl py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          ✓ {isWA ? "פתח WhatsApp" : "אשרתי"}
        </button>
        <button
          onClick={() => onAction(p.id, "dismissed")}
          className="px-4 bg-canvas text-ink/40 rounded-xl py-2 text-xs hover:text-ink/60 transition-colors"
        >
          דחה
        </button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [proposals, setProposals] = useState([]);
  const [regenerating, setRegenerating] = useState(false);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const [sending, setSending]           = useState(false);
  const [sendResult, setSendResult]     = useState("");
  const [sendingRenewal, setSendingRenewal] = useState(false);
  const [renewalResult, setRenewalResult]   = useState("");
  const [sendingToday, setSendingToday] = useState(false);
  const [todayResult, setTodayResult]   = useState("");
  const [sendingEmergency, setSendingEmergency] = useState(false);
  const [emergencyResult, setEmergencyResult]   = useState("");
  const [sendingBlast, setSendingBlast]         = useState(false);
  const [blastResult, setBlastResult]           = useState("");
  const [selftesting, setSelftesting]           = useState(false);
  const [selftestResult, setSelftestResult]     = useState(null);
  const [unsubEmail, setUnsubEmail]             = useState("");
  const [unsubbing, setUnsubbing]               = useState(false);
  const [unsubResult, setUnsubResult]           = useState("");
  const [searchQuery, setSearchQuery]           = useState("");
  const [searchResults, setSearchResults]       = useState(null);
  const [searching, setSearching]               = useState(false);

  const loadStats = async (attempt = 0) => {
    setError("");
    setLoading(true);
    const { data: res, error: err } = await supabase.functions.invoke("admin-stats");
    if (err) {
      const isFetch = /failed to send a request/i.test(err.message || "");
      if (isFetch && attempt < 4) {
        await new Promise(r => setTimeout(r, 2000 + attempt * 1500));
        return loadStats(attempt + 1);
      }
      let detail = "";
      try { detail = (await err.context?.json?.())?.detail || ""; } catch { /* not JSON */ }
      setError(detail
        ? `שגיאת שרת: ${detail}`
        : isFetch
          ? "השרת לא הגיב אחרי כמה ניסיונות (ייתכן עומס רגעי) — נסי שוב 🔄"
          : err.message);
    } else {
      setData(res);
      setProposals(res?.proposals ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const handleProposal = async (id, status, proposal = null) => {
    if (status === "approved" && proposal?.action_type === "whatsapp") {
      const msg   = encodeURIComponent(proposal.action_payload?.message ?? "");
      const phone = proposal.action_payload?.phone ?? "972509139137";
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    }
    const { error: err } = await supabase.from("proposals").update({
      status,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (err) { alert("לא הצלחנו לעדכן את ההצעה — נסי שוב"); return; }
    setProposals(prev => prev.filter(p => p.id !== id));
  };

  const generateInsight = async () => {
    setInsightLoading(true);
    const { data: res } = await supabase.functions.invoke("admin-stats", {
      body: { generateInsight: true },
    });
    if (res?.insight) setInsight(res.insight);
    setInsightLoading(false);
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data: res, error: err } = await supabase.functions.invoke("admin-stats", {
      body: { searchEmail: q },
    });
    setSearchResults(err ? [] : (res?.searchResults ?? []));
    setSearching(false);
  };

  const regenerateProposals = async () => {
    setRegenerating(true);
    const { data: res } = await supabase.functions.invoke("admin-stats", {
      body: { generateProposals: true },
    });
    if (res?.proposals) setProposals(res.proposals);
    setRegenerating(false);
  };

  const fmtFollowupResult = (res, err, label) => {
    if (err) return `שגיאה: ${err.message}`;
    if (res?.error) return `שגיאה: ${res.error}${res.detail ? ` — ${res.detail}` : ""}`;
    const dbg = res?._debug ?? {};
    const parts = [];
    if (dbg.list_users_error) parts.push(`⚠️ שגיאת רישום משתמשים: ${dbg.list_users_error}`);
    if (dbg.auth_users_found != null) parts.push(`${dbg.auth_users_found} משתמשים במערכת`);
    if (dbg.profiles_found  != null) parts.push(`${dbg.profiles_found} פרופילים`);
    if (res?.errors?.length) parts.push(`⚠️ ${res.errors.length} שגיאות שליחה — ${String(res.errors[0]).slice(0, 140)}`);
    const suffix = parts.length ? ` · ${parts.join(" · ")}` : "";
    return `${label}${suffix}`;
  };

  const triggerFollowup = async () => {
    setSending(true); setSendResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: {} });
    setSending(false);
    setSendResult(fmtFollowupResult(res, err, `נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.total ?? 0}`));
  };

  const triggerRenewal = async () => {
    setSendingRenewal(true); setRenewalResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-renewal-reminder", { body: {} });
    setSendingRenewal(false);
    setRenewalResult(err ? `שגיאה: ${err.message}` : `נשלחו ${res?.sent ?? 0} תזכורות מתוך ${res?.total ?? 0}`);
  };

  const triggerSameDayFollowup = async () => {
    setSendingToday(true); setTodayResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: { sameDay: true } });
    setSendingToday(false);
    setTodayResult(fmtFollowupResult(res, err, `נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.wave0_candidates ?? 0} נרשמות היום`));
  };

  const triggerBlast = async () => {
    if (!window.confirm(`שלח מייל הכרזה לכל ${data.totalUsers ?? ""} המשתמשים? (ללא קריטריונים — לכולם)`)) return;
    setSendingBlast(true); setBlastResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: { blast: true } });
    setSendingBlast(false);
    setBlastResult(fmtFollowupResult(res, err, `נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.total ?? 0}`));
  };

  const triggerEmergencyBlast = async () => {
    if (!window.confirm("שלח בלאסט חירום לכל נרשמות היום עם 0 חוברות? (כולל מי שכבר קיבלו פולואפ)")) return;
    setSendingEmergency(true); setEmergencyResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: { emergency: true } });
    setSendingEmergency(false);
    setEmergencyResult(fmtFollowupResult(res, err, `נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.wave0e_candidates ?? 0} נרשמות היום`));
  };

  const runSelftest = async () => {
    setSelftesting(true); setSelftestResult(null);
    const { data: res, error: err } = await supabase.functions.invoke("selftest-booklet", { body: {} });
    setSelftesting(false);
    if (err) setSelftestResult({ ok: false, error: err.message, steps: [] });
    else setSelftestResult(res);
  };

  const runUnsub = async () => {
    const email = unsubEmail.trim();
    if (!email) return;
    setUnsubbing(true); setUnsubResult("");
    const { data: res, error: err } = await supabase.functions.invoke("admin-unsubscribe", { body: { email } });
    setUnsubbing(false);
    if (err) setUnsubResult(`שגיאה: ${err.message}`);
    else if (res?.ok) { setUnsubResult(`✓ ${res.email} הוסר/ה מרשימת התפוצה`); setUnsubEmail(""); }
    else setUnsubResult(`⚠️ ${res?.error ?? "לא הצליח"}`);
  };

  if (loading) return <div className="text-center py-12 text-ink/40">טוען נתוני ניהול…</div>;
  if (error)   return (
    <div className="text-center py-12 space-y-4">
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={() => loadStats()} className="px-5 py-2 rounded-xl bg-magic text-white text-sm font-semibold hover:opacity-90">
        🔄 נסי שוב
      </button>
    </div>
  );
  if (!data)   return null;

  // P&L
  const revenueLines = Object.entries(data.planBreakdown ?? {})
    .filter(([plan]) => PLAN_PRICE[plan] != null)
    .map(([plan, count]) => ({ plan, count, price: PLAN_PRICE[plan], total: count * PLAN_PRICE[plan] }));
  const totalMRR     = revenueLines.reduce((s, r) => s + r.total, 0);
  const apiCostNIS   = (data.bookletsThisMonth ?? 0) * COST_PER_BOOKLET_NIS;
  const fixedCostNIS = SUPABASE_MONTHLY_NIS + VERCEL_MONTHLY_NIS;
  const totalCostNIS = apiCostNIS + fixedCostNIS;
  const netProfitNIS = totalMRR - totalCostNIS;
  const paidUsers    = revenueLines.reduce((s, r) => s + r.count, 0);

  const statCards = [
    { label: "סה׳כ משתמשים",  value: data.totalUsers,         icon: "👥" },
    { label: "השבוע",          value: data.usersThisWeek,      icon: "📅" },
    { label: "היום",           value: data.usersToday,         icon: "⚡" },
    { label: "סה׳כ חוברות",   value: data.totalBooklets,      icon: "📚" },
    { label: "חוברות השבוע",  value: data.bookletsThisWeek,   icon: "📊" },
    { label: "חוברות היום",   value: data.bookletsToday,      icon: "🔥" },
  ];

  const fs = data.funnelStats ?? { sessions: 0, started: 0, completed: 0, upgradeOpened: 0, ctaClicked: 0, leads: 0 };
  const convStart = fs.sessions > 0 ? Math.round((fs.started / fs.sessions) * 100) : 0;
  const convDone  = fs.started  > 0 ? Math.round((fs.completed / fs.started) * 100) : 0;
  const convCta  = fs.upgradeOpened > 0 ? Math.min(100, Math.round(((fs.ctaClicked ?? 0) / fs.upgradeOpened) * 100)) : 0;
  const convLead = fs.completed     > 0 ? Math.min(100, Math.round(((fs.upgradeOpened ?? 0) / fs.completed) * 100)) : 0;

  const an = data.analytics ?? {
    visitors: 0, signups: 0, logins: 0, activated: 0, emailSubmitted: 0, verifyView: 0,
    googleClicks: 0, shares: 0, publicViews: 0, prints: 0, pwaInstalls: 0, ratings: 0,
    feedbacks: 0, sources: [], errors: [], paywallHits: 0, totalEvents: 0,
  };
  const pct = (num, den) => (den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0);
  const convVisitSignup  = pct(an.signups, an.visitors);
  const convSignupActive = pct(an.activated, an.signups + an.logins);
  const errorTotal = (an.errors ?? []).reduce((s, e) => s + e.count, 0);

  const INSIGHT_META = {
    good:            { label: "כיוון חיובי",      emoji: "🟢", ring: "border-grow/30",  bg: "from-grow/10 to-grow/5",   text: "text-grow"  },
    mixed:           { label: "תמונה מעורבת",     emoji: "🟡", ring: "border-brand/30", bg: "from-brand/10 to-brand/5", text: "text-brand" },
    needs_attention: { label: "דורש תשומת לב",    emoji: "🔴", ring: "border-red-300",  bg: "from-red-50 to-red-50/40", text: "text-red-600" },
  };
  const im = INSIGHT_META[insight?.direction] ?? INSIGHT_META.mixed;

  return (
    <div className="space-y-6">

      {/* ── 🩺 System health (today) ────── */}
      {(() => {
        const r = data.reliability ?? { startedToday: 0, completedToday: 0, errorsToday: 0, successRate: 0, errorsByType: [], versions: [] };
        const hasIssue = r.startedToday >= 3 && r.successRate < 70;
        return (
          <div className={`rounded-2xl p-4 border-2 shadow-sm ${hasIssue ? "bg-red-50 border-red-300" : "bg-grow/5 border-grow/25"}`}>
            <h3 className="font-bold text-ink text-sm mb-3">🩺 בריאות המערכת — היום</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center bg-white/70 rounded-xl p-2.5">
                <div className={`text-2xl font-bold font-display ${!r.startedToday ? "text-ink/30" : r.successRate >= 70 ? "text-grow" : "text-red-500"}`}>{r.startedToday ? `${r.successRate}%` : "—"}</div>
                <div className="text-[10px] text-ink/40 mt-0.5">אחוז הצלחה</div>
              </div>
              <div className="text-center bg-white/70 rounded-xl p-2.5">
                <div className="text-2xl font-bold text-ink font-display">{r.completedToday}/{r.startedToday}</div>
                <div className="text-[10px] text-ink/40 mt-0.5">נוצרו / ניסו</div>
              </div>
              <div className="text-center bg-white/70 rounded-xl p-2.5">
                <div className={`text-2xl font-bold font-display ${r.errorsToday ? "text-red-500" : "text-grow"}`}>{r.errorsToday}</div>
                <div className="text-[10px] text-ink/40 mt-0.5">כשלים</div>
              </div>
            </div>
            {(r.errorsByType ?? []).length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] font-semibold text-ink/50 mb-1">כשלים לפי סוג (📱 = דפדפן מוטמע):</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.errorsByType.map((e) => (
                    <span key={e.type} className="text-[11px] bg-white border border-ink/10 rounded-full px-2 py-0.5 text-ink/70">
                      {e.type}: <strong className="text-red-500">{e.count}</strong>{e.inapp > 0 ? ` 📱${e.inapp}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(r.versions ?? []).length > 1 && (
              <p className="text-[10px] text-ink/40 leading-relaxed">
                גרסאות פעילות היום: {r.versions.map((v) => `${v.v}(${v.count})`).join(" · ")} — אם יש כמה, חלק מהמשתמשים על <strong>קוד ישן מהמטמון</strong>.
              </p>
            )}
            {!r.startedToday && <p className="text-[11px] text-ink/40">אף אחד עוד לא ניסה ליצור חוברת היום.</p>}
          </div>
        );
      })()}

      {/* ── AI strategic insight ──────────── */}
      <div className={`rounded-2xl p-5 border-2 shadow-sm bg-gradient-to-bl ${insight ? `${im.ring} ${im.bg}` : "border-magic/20 from-magic/5 to-brand/5"}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-ink text-sm flex items-center gap-2">
            <span className="text-lg">🧠</span> תובנת AI — המסקנה מכל הנתונים
          </h3>
          <button
            onClick={generateInsight}
            disabled={insightLoading}
            className="text-xs bg-magic/10 text-magic px-3 py-1.5 rounded-xl font-medium disabled:opacity-40 hover:bg-magic/20 transition-colors flex-shrink-0"
          >
            {insightLoading ? "מנתח…" : insight ? "↻ רענן" : "⚡ נתח עכשיו"}
          </button>
        </div>
        {insight ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white/70 ${im.text}`}>{im.emoji} {im.label}</span>
            </div>
            <p className="text-base font-bold text-ink leading-snug">{insight.headline}</p>
            {insight.reading && <p className="text-sm text-ink/70 leading-relaxed">{insight.reading}</p>}
            {insight.biggest_lever && (
              <div className="bg-white/70 rounded-xl p-3 border border-ink/5">
                <p className="text-[11px] font-bold text-magic mb-0.5">🎯 המהלך הכי חשוב עכשיו</p>
                <p className="text-sm text-ink/80 leading-relaxed">{insight.biggest_lever}</p>
              </div>
            )}
            {insight.watch && (
              <p className="text-xs text-ink/50">👁 מדד לעקוב אחריו השבוע: <span className="font-medium text-ink/70">{insight.watch}</span></p>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink/50">לחצי "נתח עכשיו" — ה-AI יקרא את כל המשפך, ההמרות, הצמיחה והתקלות, ויחזיר מסקנה אחת: האם אנחנו בכיוון הנכון ומה הדבר הבא לשפר.</p>
        )}
      </div>

      {/* ── Silent-failure detector ── */}
      {(() => {
        const sf = data.silentFailures ?? { count: 0, recentCount: 0, errorBreakdown: [], recentErrorBreakdown: [], users: [] };
        const notQuota = (e) => e.type !== "quota" && e.type !== "quota_monthly";
        const realAll    = (sf.errorBreakdown ?? []).filter(notQuota);
        const realRecent = (sf.recentErrorBreakdown ?? []).filter(notQuota);
        const realCountAll    = realAll.reduce((s, e) => s + e.count, 0);
        const realCountRecent = realRecent.reduce((s, e) => s + e.count, 0);
        const liveProblem = realCountRecent > 0;
        return (
          <div className={`rounded-2xl p-4 border-2 shadow-sm ${liveProblem ? "bg-red-50 border-red-300" : "bg-grow/5 border-grow/25"}`}>
            <h3 className={`font-bold text-sm mb-1 ${liveProblem ? "text-red-700" : "text-grow"}`}>
              {liveProblem ? "🔴 כשל שקט פעיל — דורש בדיקה עכשיו" : "🟢 אין כשל שקט פעיל (3 ימים אחרונים)"}
            </h3>

            {liveProblem ? (
              <>
                <p className="text-xs text-red-600 mb-2">
                  <strong>{realCountRecent}</strong> משתמשים נכשלו ביצירה ב-<strong>3 הימים האחרונים</strong> (לחצו "צור" ונשארו עם 0 חוברות). זו תקלה חיה.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {realRecent.map(e => (
                    <span key={e.type} className="text-[11px] bg-white border border-red-200 text-red-600 rounded-full px-2 py-0.5">
                      {e.type}: <strong>{e.count}</strong>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-grow/90 mb-2">
                אף משתמש לא נכשל ביצירה ב-3 הימים האחרונים. {realCountAll > 0 && <>הכשלים שמופיעים למטה הם <strong>היסטוריים</strong> (מלפני התיקונים, בחלון 30 הימים) — לא קורים יותר.</>}
              </p>
            )}

            {realCountAll > 0 && (
              <details className="mt-1">
                <summary className="text-[11px] text-ink/45 cursor-pointer">היסטוריה (30 יום): {realCountAll} כשלים — לחצי לפירוט</summary>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {realAll.map(e => (
                    <span key={e.type} className="text-[11px] bg-white border border-ink/15 text-ink/50 rounded-full px-2 py-0.5">
                      {e.type}: <strong>{e.count}</strong>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-ink/40 mt-2">
                  ai_overloaded = השרת עמוס · stream_dropped = החיבור נקטע · db_insert_failed = השמירה ב-DB נכשלה · empty_html = לא חזר תוכן · network = רשת/דפדפן מוטמע
                </p>
              </details>
            )}
            {sf.count === 0 && (
              <p className="text-xs text-ink/50">אף משתמש לא לחץ "צור" בלי לקבל חוברת ב-30 יום — משתמשים עם 0 חוברות פשוט לא ניסו.</p>
            )}
          </div>
        );
      })()}

      {/* ── Self-test ───────── */}
      <div className={`rounded-2xl p-4 border-2 shadow-sm ${
        selftestResult == null ? "bg-magic/5 border-magic/25"
        : selftestResult.ok ? "bg-grow/5 border-grow/30" : "bg-red-50 border-red-300"
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink text-sm">🧪 בדיקת יצירת חוברת (משתמש אמיתי)</h3>
            <p className="text-[11px] text-ink/50 mt-0.5">
              יוצר משתמש בדיקה לא-אדמין, מנסה לשמור חוברת דרך אותו מסלול שנכשל, ומוחק הכל אחריו.
            </p>
          </div>
          <button
            onClick={runSelftest}
            disabled={selftesting}
            className="flex-shrink-0 bg-magic text-white rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {selftesting ? "בודק…" : "▶ הרץ בדיקה"}
          </button>
        </div>
        {selftestResult && (
          <div className="mt-3">
            <p className={`text-sm font-bold ${selftestResult.ok ? "text-grow" : "text-red-600"}`}>
              {selftestResult.ok
                ? "🟢 התיקון מאומת — משתמש רגיל יכול ליצור חוברת והיא נשמרת!"
                : `🔴 הבדיקה נכשלה${selftestResult.insert_error ? ` — ${selftestResult.insert_error}` : selftestResult.error ? ` — ${selftestResult.error}` : ""}`}
            </p>
            {(selftestResult.steps ?? []).length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {selftestResult.steps.map((s, i) => (
                  <li key={i} className="text-[11px] text-ink/60 font-mono">{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Agent proposals */}
      {proposals.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink text-sm">🤖 הצעות הסוכנים ({proposals.length})</h3>
            <button
              onClick={regenerateProposals}
              disabled={regenerating}
              className="text-xs text-ink/40 hover:text-ink/70 disabled:opacity-40 transition-colors"
            >
              {regenerating ? "מחשב…" : "↻ חדש"}
            </button>
          </div>
          {proposals.map(p => (
            <ProposalCard key={p.id} proposal={p} onAction={handleProposal} />
          ))}
        </div>
      ) : (
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink/50">אין הצעות ממתינות</p>
            <p className="text-xs text-ink/30">הסוכנים מייצרים הצעות כל יום ב-8:00</p>
          </div>
          <button
            onClick={regenerateProposals}
            disabled={regenerating}
            className="text-xs bg-magic/10 text-magic px-3 py-1.5 rounded-xl font-medium disabled:opacity-40 hover:bg-magic/20 transition-colors"
          >
            {regenerating ? "מחשב…" : "⚡ יצר עכשיו"}
          </button>
        </div>
      )}

      {/* Funnel (last 7 days) */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">📊 משפך 7 ימים אחרונים</h3>
        {fs.sessions === 0 && fs.started === 0 ? (
          <p className="text-xs text-ink/30">עדיין אין נתוני event tracking — ייאסף החל מהיום</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.sessions}</div>
              <div className="text-xs text-ink/40 mt-0.5">כניסות</div>
            </div>
            <div className="text-ink/20">→</div>
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.started}</div>
              <div className="text-xs text-ink/40 mt-0.5">התחילו</div>
              {convStart > 0 && <div className="text-xs text-magic font-bold mt-0.5">{convStart}%</div>}
            </div>
            <div className="text-ink/20">→</div>
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.completed}</div>
              <div className="text-xs text-ink/40 mt-0.5">סיימו</div>
              {convDone > 0 && <div className="text-xs text-grow font-bold mt-0.5">{convDone}%</div>}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade funnel */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">💰 משפך שדרוג — 7 ימים</h3>
        {(fs.upgradeOpened ?? 0) === 0 && (fs.ctaClicked ?? 0) === 0 && (fs.leads ?? 0) === 0 ? (
          <p className="text-xs text-ink/30">עדיין אין נתוני שדרוג — ייאסף החל מהיום (מי ראה מסך תשלום, מי לחץ, מי השאיר ליד)</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.completed}</div>
              <div className="text-xs text-ink/40 mt-0.5">סיימו חוברת</div>
            </div>
            <div className="text-ink/20">→</div>
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.upgradeOpened ?? 0}</div>
              <div className="text-xs text-ink/40 mt-0.5">ראו תשלום</div>
              {convLead > 0 && <div className="text-xs text-magic font-bold mt-0.5">{convLead}%</div>}
            </div>
            <div className="text-ink/20">→</div>
            <div className="flex-1 text-center bg-canvas rounded-xl p-3">
              <div className="text-2xl font-bold text-ink font-display">{fs.ctaClicked ?? 0}</div>
              <div className="text-xs text-ink/40 mt-0.5">לחצו תשלום</div>
              {convCta > 0 && <div className="text-xs text-magic font-bold mt-0.5">{convCta}%</div>}
            </div>
            <div className="text-ink/20">→</div>
            <div className="flex-1 text-center bg-grow/8 rounded-xl p-3 border border-grow/20">
              <div className="text-2xl font-bold text-grow font-display">{fs.leads ?? 0}</div>
              <div className="text-xs text-ink/40 mt-0.5">לידים 🔥</div>
            </div>
          </div>
        )}
      </div>

      {/* FULL FUNNEL ANALYTICS */}
      {an.totalEvents > 0 ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
            <h3 className="font-bold text-ink mb-3 text-sm">🚀 משפך רכישה מלא — 7 ימים</h3>
            <div className="flex items-center gap-2">
              {[
                { label: "מבקרים", value: an.visitors, color: "text-ink" },
                { label: "הרשמות", value: an.signups, pct: convVisitSignup, color: "text-magic" },
                { label: "התחברו", value: an.logins, color: "text-ink" },
                { label: "יצרו חוברת", value: an.activated, pct: convSignupActive, color: "text-grow" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2 flex-1">
                  {i > 0 && <div className="text-ink/20">→</div>}
                  <div className="flex-1 text-center bg-canvas rounded-xl p-3">
                    <div className={`text-xl font-bold font-display ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-ink/40 mt-0.5">{s.label}</div>
                    {s.pct > 0 && <div className="text-[11px] text-magic font-bold mt-0.5">{s.pct}%</div>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-ink/30 mt-2 text-center">{an.totalEvents.toLocaleString("he-IL")} אירועים נמדדו · מבקר→הרשמה {convVisitSignup}% · הרשמה→חוברת {convSignupActive}%</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
              <h3 className="font-bold text-ink mb-3 text-sm">🌐 מקורות תנועה</h3>
              {(an.sources ?? []).length === 0 ? (
                <p className="text-xs text-ink/30">אין נתוני מקור עדיין</p>
              ) : (
                <div className="space-y-1.5">
                  {an.sources.map(s => (
                    <div key={s.source} className="flex items-center justify-between text-sm">
                      <span className="text-ink/70">{s.source}</span>
                      <span className="font-bold text-ink">{s.visitors}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
              <h3 className="font-bold text-ink mb-3 text-sm">📣 הפצה ומעורבות</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                {[
                  { label: "שיתופים", value: an.shares, icon: "🔗" },
                  { label: "צפיות בשיתוף", value: an.publicViews, icon: "👀" },
                  { label: "הדפסות", value: an.prints, icon: "🖨️" },
                  { label: "התקנות PWA", value: an.pwaInstalls, icon: "📱" },
                  { label: "דירוגים", value: an.ratings, icon: "⭐" },
                  { label: "פידבקים", value: an.feedbacks, icon: "💬" },
                ].map(m => (
                  <div key={m.label} className="bg-canvas rounded-lg p-2">
                    <div className="text-base font-bold text-ink font-display">{m.icon} {m.value}</div>
                    <div className="text-[10px] text-ink/40">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {errorTotal > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
              <h3 className="font-bold text-ink mb-3 text-sm">⚠️ תקלות ייצור — {errorTotal} ב-7 ימים</h3>
              <div className="flex flex-wrap gap-2">
                {an.errors.map(e => (
                  <span key={e.type} className="text-xs bg-red-50 border border-red-200 text-red-600 rounded-full px-2.5 py-1">
                    {e.type}: <strong>{e.count}</strong>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-ink/30 mt-2">quota = פגיעה ב-paywall (טוב) · ai_overloaded/timeout/network/stream = תקלות אמיתיות לתיקון</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5">
          <p className="text-sm font-medium text-ink/50">📊 משפך מלא — ייאסף החל מהפריסה</p>
          <p className="text-xs text-ink/30 mt-0.5">מבקרים אנונימיים, מקורות תנועה, הפצה, ותקלות ייצור יופיעו כאן תוך יום</p>
        </div>
      )}

      {/* Quality signals */}
      {(data.ratedBooklets > 0 || data.churnRiskCount > 0) && (
        <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
          <h3 className="font-bold text-ink mb-3 text-sm">🎯 איכות ונטישה</h3>
          <div className="flex gap-4 items-start">
            {data.ratedBooklets > 0 && (
              <div className="flex-1">
                <p className="text-xs text-ink/40 mb-2">דירוג חוברות ({data.ratedBooklets} מדורגות)</p>
                <div className="space-y-1.5">
                  {[
                    { key: "just_right", emoji: "😊", label: "בדיוק",   color: "bg-grow"     },
                    { key: "too_easy",   emoji: "🌟", label: "קל מדי", color: "bg-brand"    },
                    { key: "too_hard",   emoji: "😓", label: "קשה מדי", color: "bg-red-400"  },
                  ].map(({ key, emoji, label, color }) => {
                    const count = (data.difficultyBreakdown ?? {})[key] ?? 0;
                    const pct   = data.ratedBooklets > 0 ? Math.round((count / data.ratedBooklets) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm w-5 flex-shrink-0">{emoji}</span>
                        <div className="flex-1 h-2 bg-canvas rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-ink/50 w-16 text-left">{label}: {count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {data.churnRiskCount > 0 && (
              <div className="flex-shrink-0 text-center bg-red-50 rounded-xl p-3 border border-red-100 min-w-[80px]">
                <div className="text-2xl font-bold text-red-500 font-display">{data.churnRiskCount}</div>
                <div className="text-[10px] text-red-400 font-semibold mt-0.5">בסיכון נטישה</div>
                <div className="text-[10px] text-ink/30 mt-0.5">3+ ימים ללא חוברת</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dormant users */}
      {(data.dormantCount ?? 0) > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-ink text-sm">😴 שקטות — היו פעילות, לא חזרו</h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {data.dormantCount}
            </span>
          </div>
          <p className="text-[11px] text-ink/40 mb-3">
            יצרו לפחות חוברת אחת — לא חזרו 4+ ימים. אלה הכי קרובות לחזרה — כבר הגיעו ל-aha moment.
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(data.dormantUsers ?? []).map((u, i) => {
              const days = daysSince(u.lastBookletAt);
              return (
                <div key={i} className="flex justify-between items-center bg-canvas rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1">
                    {u.name && <p className="text-xs font-medium text-ink truncate">{u.name}</p>}
                    <p className="text-xs text-ink/60 font-mono truncate">{u.email}</p>
                    <p className="text-[10px] text-ink/30">{u.bookletCount} חוברות</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {days !== null && (
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        days <= 5 ? "text-amber-600 bg-amber-50" : "text-red-500 bg-red-50"
                      }`}>
                        {days}י' שקט
                      </span>
                    )}
                    <button
                      onClick={() => { try { navigator.clipboard?.writeText(u.email); } catch {} }}
                      className="text-[10px] text-ink/30 hover:text-magic transition-colors px-2 py-1 rounded"
                      title="העתק מייל"
                    >
                      📋
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-ink/5 text-center shadow-sm">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-ink font-display">{value}</div>
            <div className="text-xs text-ink/40 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Retention funnel */}
      {data.totalNonAdminUsers > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
          <h3 className="font-bold text-ink mb-3 text-sm">🔄 שימור — מסלול המשתמש</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "יצרו חוברת אחת", value: data.usersWithAnyBooklet, color: "text-brand", bar: "bg-brand" },
              { label: "יצרו 2+ חוברות", value: data.retentionToSecond,   color: "text-magic", bar: "bg-magic" },
              { label: "3+ חוברות (הרגל)", value: data.retentionToThird,  color: "text-grow",  bar: "bg-grow"  },
            ].map(({ label, value, color, bar }) => {
              const pct = Math.round(((value ?? 0) / data.totalNonAdminUsers) * 100);
              return (
                <div key={label} className="bg-canvas rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold font-display ${color}`}>{pct}%</div>
                  <div className="text-[11px] text-ink/50 mt-0.5">{value ?? 0}/{data.totalNonAdminUsers}</div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden mt-2">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-ink/35 mt-1.5 leading-tight">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade opportunities */}
      {(data.freeAtLimitCount ?? 0) > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-brand/25 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-ink text-sm">⚡ הזדמנויות שדרוג</h3>
            <span className="bg-brand/10 text-brand text-xs font-bold px-2.5 py-1 rounded-full">
              {data.freeAtLimitCount}
            </span>
          </div>
          <p className="text-[11px] text-ink/40 mb-3">
            משתמשים חינם שהגיעו ל-2 חוברות — הכי קרובים להמרה
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {(data.freeAtLimitUsers ?? []).map((u, i) => (
              <div key={i} className="flex justify-between items-center bg-canvas rounded-xl px-3 py-2">
                <div className="min-w-0 flex-1">
                  {u.name && <p className="text-xs font-medium text-ink truncate">{u.name}</p>}
                  <p className="text-xs text-ink/60 font-mono truncate">{u.email}</p>
                  <p className="text-[10px] text-ink/30">{u.bookletCount} חוברות</p>
                </div>
                <button
                  onClick={() => { try { navigator.clipboard?.writeText(u.email); } catch {} }}
                  className="text-[10px] text-ink/30 hover:text-magic transition-colors px-2 py-1 rounded flex-shrink-0"
                  title="העתק מייל"
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Economics / P&L */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">💰 כלכלה — חודש נוכחי</h3>
        <div className="space-y-1.5 mb-3">
          {revenueLines.length === 0 && <p className="text-xs text-ink/30">אין מנויים פעילים עדיין</p>}
          {revenueLines.map(({ plan, count, price, total }) => (
            <div key={plan} className="flex justify-between items-center text-xs">
              <span className="text-ink/50">
                {plan === "teacher" ? "מורה" : plan === "parent" ? "הורה" : "פרו (ישן)"} × {count} ({price} ₪)
              </span>
              <span className="font-semibold text-grow">+{total} ₪</span>
            </div>
          ))}
          <div className="flex justify-between items-center text-sm border-t border-ink/5 pt-1.5">
            <span className="font-bold text-ink">הכנסות (MRR)</span>
            <span className="font-bold text-grow">+{totalMRR} ₪</span>
          </div>
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink/50">API אנתרופיק ({data.bookletsThisMonth ?? 0} חוברות × {COST_PER_BOOKLET_NIS} ₪)</span>
            <span className="font-semibold text-red-400">−{apiCostNIS.toFixed(1)} ₪</span>
          </div>
          {fixedCostNIS > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink/50">תשתיות (Supabase, Vercel)</span>
              <span className="font-semibold text-red-400">−{fixedCostNIS} ₪</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm border-t border-ink/5 pt-1.5">
            <span className="font-bold text-ink">הוצאות (הערכה)</span>
            <span className="font-bold text-red-400">−{totalCostNIS.toFixed(1)} ₪</span>
          </div>
        </div>
        <div className={`flex justify-between items-center rounded-xl px-3 py-2 ${netProfitNIS >= 0 ? "bg-grow/10" : "bg-red-50"}`}>
          <span className="font-bold text-sm text-ink">רווח נקי</span>
          <span className={`font-bold text-lg ${netProfitNIS >= 0 ? "text-grow" : "text-red-500"}`}>
            {netProfitNIS >= 0 ? "+" : ""}{netProfitNIS.toFixed(1)} ₪
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center bg-canvas rounded-xl p-2">
            <div className="text-lg font-bold text-ink font-display">{paidUsers}</div>
            <div className="text-[10px] text-ink/40">מנויים פעילים</div>
          </div>
          <div className="text-center bg-canvas rounded-xl p-2">
            <div className="text-lg font-bold text-ink font-display">{data.bookletsThisMonth ?? 0}</div>
            <div className="text-[10px] text-ink/40">חוברות החודש</div>
          </div>
          <div className="text-center bg-canvas rounded-xl p-2">
            <div className="text-lg font-bold text-ink font-display">
              {paidUsers > 0 ? (totalMRR / paidUsers).toFixed(0) : 0}₪
            </div>
            <div className="text-[10px] text-ink/40">ARPU</div>
          </div>
        </div>
        <p className="text-[10px] text-ink/25 mt-2 text-center">עלות API מחושבת לפי הערכה — ~0.65 ₪/חוברת (Sonnet + adaptive thinking)</p>
        {paidUsers > 0 && (
          <div className="mt-2 bg-grow/8 rounded-xl px-3 py-2 text-center border border-grow/15">
            <p className="text-xs font-bold text-grow">
              LTV:CAC ≈ {Math.round((59 * 6) / (2.5 * COST_PER_BOOKLET_NIS))}x
            </p>
            <p className="text-[10px] text-ink/40 mt-0.5">
              LTV ~₪{59 * 6} (מורה × 6 חודש) ÷ CAC ~₪{(2.5 * COST_PER_BOOKLET_NIS).toFixed(1)} (API free tier)
            </p>
          </div>
        )}
      </div>

      {/* Plan breakdown */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink text-sm">פילוח תוכניות</h3>
          {data.totalNonAdminUsers > 0 && paidUsers > 0 && (
            <span className="text-xs text-magic font-bold bg-magic/8 px-2 py-0.5 rounded-full">
              {Math.round((paidUsers / data.totalNonAdminUsers) * 100)}% המרה חינם→פרו
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(data.planBreakdown ?? {}).map(([plan, count]) => (
            <span key={plan} className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              plan === "teacher" ? "bg-magic/10 text-magic" :
              plan === "parent"  ? "bg-brand/10 text-brand" :
              plan === "pro"     ? "bg-magic/10 text-magic" :
              plan === "admin"   ? "bg-grow/10 text-grow"   :
              "bg-canvas text-ink/50"
            }`}>
              {plan === "teacher" ? "🚀 מורה" : plan === "parent" ? "🌟 הורה" : plan}: {count}
            </span>
          ))}
        </div>
        {data.totalNonAdminUsers > 0 && (
          <div className="mt-3 h-2 bg-canvas rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand to-magic rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.round((paidUsers / data.totalNonAdminUsers) * 100))}%` }}
            />
          </div>
        )}
      </div>

      {/* Popular topics */}
      {data.topTopics?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
          <h3 className="font-bold text-ink mb-3 text-sm">נושאים פופולריים 🔥 (200 אחרונים)</h3>
          <div className="space-y-1.5">
            {data.topTopics.map(({ topic, count }, i) => {
              const max = data.topTopics[0].count;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-ink/30 w-4 text-left">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-ink/80 truncate">{topic}</span>
                      <span className="text-xs text-ink/40 mr-2 flex-shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand to-magic rounded-full"
                        style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automation triggers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-magic/5 rounded-2xl p-4 border-2 border-magic/30 col-span-2">
          <div className="flex items-start gap-2 mb-1">
            <span className="text-lg flex-shrink-0">📢</span>
            <div>
              <h3 className="font-bold text-magic text-sm">מייל הכרזה — לכל המשתמשים</h3>
              <p className="text-xs text-ink/50 mt-0.5">שולח לכולם (ללא קריטריונים) · "שדרגנו, חזרנו, הנה מדריך קצר" · 60 שניות</p>
            </div>
          </div>
          <button onClick={triggerBlast} disabled={sendingBlast}
            className="bg-magic text-white rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity w-full mt-2">
            {sendingBlast ? "שולח…" : "📢 שלח לכולם עכשיו"}
          </button>
          {blastResult && <p className="text-xs text-magic font-semibold mt-2">{blastResult}</p>}
        </div>

        <div className="bg-red-50 rounded-2xl p-4 border-2 border-red-300 col-span-2">
          <div className="flex items-start gap-2 mb-1">
            <span className="text-lg flex-shrink-0">🚨</span>
            <div>
              <h3 className="font-bold text-red-700 text-sm">בלאסט חירום — נרשמות היום עם 0 חוברות</h3>
              <p className="text-xs text-red-400 mt-0.5">שולח לכולן (גם מי שקיבלה פולואפ כבר) · "שמנו לב שנתקעת, הנה עזרה אישית" · 60 שניות</p>
            </div>
          </div>
          <button onClick={triggerEmergencyBlast} disabled={sendingEmergency}
            className="bg-red-500 text-white rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity w-full mt-2">
            {sendingEmergency ? "שולח…" : "🚨 שלח בלאסט חירום עכשיו"}
          </button>
          {emergencyResult && <p className="text-xs text-red-600 font-semibold mt-2">{emergencyResult}</p>}
        </div>

        <div className="bg-canvas rounded-2xl p-4 border border-magic/30">
          <h3 className="font-bold text-ink mb-1 text-sm">⚡ נרשמות של היום</h3>
          <p className="text-xs text-ink/40 mb-3">שלח עכשיו לכל מי שנרשמה היום ועוד לא יצרה חוברת (2+ שעות).</p>
          <button onClick={triggerSameDayFollowup} disabled={sendingToday}
            className="bg-magic text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full">
            {sendingToday ? "שולח…" : "שלח לחדשות ✨"}
          </button>
          {todayResult && <p className="text-xs text-grow mt-2">{todayResult}</p>}
        </div>
        <div className="bg-canvas rounded-2xl p-4 border border-magic/20">
          <h3 className="font-bold text-ink mb-1 text-sm">📧 פולואפ אוטומטי — סטטוס</h3>
          <p className="text-[11px] text-ink/40 mb-2">רץ כל יומיים אוטומטית. כל משתמש מקבל כל סוג פעם אחת בלבד.</p>
          {(() => {
            const s = data.emailLogStats ?? { on_limit: 0, tried_failed: 0, not_activated: 0, created_one: 0, total: 0 };
            const rows = [
              { key: "not_activated", label: "לא התחילו", color: "text-brand" },
              { key: "tried_failed",  label: "ניסו ונכשלו", color: "text-red-500" },
              { key: "created_one",   label: "חוברת אחת", color: "text-magic" },
              { key: "on_limit",      label: "סיימו מכסה", color: "text-grow" },
            ];
            return (
              <div className="space-y-1">
                {rows.map(r => (
                  <div key={r.key} className="flex justify-between text-xs">
                    <span className="text-ink/50">{r.label}</span>
                    <span className={`font-bold ${r.color}`}>{s[r.key]}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs border-t border-ink/10 pt-1 mt-1">
                  <span className="font-semibold text-ink/60">סה׳כ נשלחו</span>
                  <span className="font-bold text-ink">{s.total}</span>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="bg-canvas rounded-2xl p-4 border border-magic/20">
          <h3 className="font-bold text-ink mb-1 text-sm">📋 סקר משתמשות — תשובות</h3>
          <p className="text-[11px] text-ink/40 mb-2">לחיצה אחת — מה הן אמרו</p>
          {(() => {
            const sb = data.surveyBreakdown ?? {};
            const LABELS = {
              use_case: { q: "לאיזה מצב משתמשת?", answers: { private_lessons: "שיעורים פרטיים", full_class: "כיתה שלמה", homework: "שיעורי בית" } },
              barrier:  { q: "מה עצר אותך?",      answers: { no_time: "לא היה זמן", didnt_understand: "לא הבנתי", no_topic: "לא מצאתי נושא" } },
              monthly_need: { q: "כמה חוברות בחודש?", answers: { up_to_5: "עד 5", five_to_15: "5–15", twenty_plus: "20+" } },
            };
            return (
              <div className="space-y-3">
                {Object.entries(LABELS).map(([qKey, meta]) => {
                  const answers = sb[qKey] ?? {};
                  const total = Object.values(answers).reduce((s, n) => s + n, 0);
                  if (total === 0) return (
                    <div key={qKey}>
                      <p className="text-[11px] font-semibold text-ink/50 mb-0.5">{meta.q}</p>
                      <p className="text-[10px] text-ink/30">טרם נאספו תשובות</p>
                    </div>
                  );
                  return (
                    <div key={qKey}>
                      <p className="text-[11px] font-semibold text-ink/50 mb-1">{meta.q} ({total})</p>
                      {Object.entries(meta.answers).map(([val, label]) => {
                        const count = answers[val] ?? 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={val} className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-16 h-1.5 bg-white rounded-full overflow-hidden">
                              <div className="h-full bg-magic rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-ink/60 flex-1">{label}</span>
                            <span className="text-[10px] font-bold text-magic">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5 col-span-2">
          <h3 className="font-bold text-ink mb-1 text-sm">תזכורת חידוש D+25</h3>
          <p className="text-xs text-ink/40 mb-3">מזכיר לפרו לחדש 5 ימים לפני הסוף.</p>
          <button onClick={triggerRenewal} disabled={sendingRenewal}
            className="bg-brand text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full">
            {sendingRenewal ? "שולח…" : "שלח עכשיו 🔄"}
          </button>
          {renewalResult && <p className="text-xs text-grow mt-2">{renewalResult}</p>}
        </div>
      </div>

      {/* Unsubscribe */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-1 text-sm">✉️ הסרה מרשימת תפוצה</h3>
        <p className="text-[11px] text-ink/40 mb-3">הזן מייל של מי שביקש/ה להפסיק לקבל מיילים — היא לא תקבל יותר.</p>
        <div className="flex gap-2">
          <input
            type="email"
            dir="ltr"
            value={unsubEmail}
            onChange={(e) => setUnsubEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runUnsub(); }}
            placeholder="name@gmail.com"
            className="flex-1 border border-ink/15 rounded-xl px-3 py-2 text-sm outline-none focus:border-magic text-left"
          />
          <button
            onClick={runUnsub}
            disabled={unsubbing || !unsubEmail.trim()}
            className="flex-shrink-0 bg-ink text-white rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {unsubbing ? "מסיר…" : "הסר"}
          </button>
        </div>
        {unsubResult && <p className={`text-xs mt-2 font-medium ${unsubResult.startsWith("✓") ? "text-grow" : "text-red-500"}`}>{unsubResult}</p>}
      </div>

      {/* User search */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-1 text-sm">🔍 חיפוש משתמש לפי מייל</h3>
        <p className="text-xs text-ink/40 mb-3">מצא כל משתמש (גם ותיק) — חוברות, פעילות אחרונה ושגיאות</p>
        <div className="flex gap-2">
          <input
            type="email"
            dir="ltr"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="name@gmail.com"
            className="flex-1 px-3 py-2 rounded-xl border border-ink/15 text-sm text-ink text-left placeholder-ink/30 focus:outline-none focus:border-magic"
          />
          <button
            onClick={runSearch}
            disabled={searching || searchQuery.trim().length < 2}
            className="px-4 py-2 rounded-xl bg-magic text-white text-sm font-semibold disabled:opacity-40"
          >
            {searching ? "מחפש…" : "חפש"}
          </button>
        </div>
        {data.userPoolCapped && (
          <p className="text-[10px] text-amber-600 mt-2">⚠️ יש מעל 1000 משתמשים — החיפוש מכסה את 1000 הראשונים בלבד</p>
        )}
        {searchResults !== null && (
          searchResults.length === 0 ? (
            <p className="text-xs text-ink/40 mt-3">לא נמצאו משתמשים עם מייל כזה.</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                {USER_TABLE_HEAD}
                <tbody>{searchResults.map(renderUserRow)}</tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">משתמשים אחרונים ({data.recentUsers?.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            {USER_TABLE_HEAD}
            <tbody>
              {(data.recentUsers ?? []).map(renderUserRow)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent feedback */}
      {data.recentFeedback?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
          <h3 className="font-bold text-ink mb-3 text-sm">פידבקים אחרונים ({data.recentFeedback.length})</h3>
          <div className="space-y-2">
            {data.recentFeedback.map((f, i) => (
              <div key={i} className="bg-canvas rounded-xl p-3 text-sm">
                <p className="text-ink/80">{f.message}</p>
                <p className="text-xs text-ink/30 mt-1">{fmt(f.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent leads — full contact context, duplicates from double-taps grouped */}
      {data.recentLeads?.length > 0 && <LeadsCard leads={data.recentLeads} fmt={fmt} />}
    </div>
  );
}

function LeadsCard({ leads, fmt }) {
  // Per-lead send state: idle | sending | sent | failed (keyed by email+index)
  const [sendState, setSendState] = useState({});

  const sendInstructions = async (key, l) => {
    if (!l.email || sendState[key] === "sending" || sendState[key] === "sent") return;
    setSendState(s => ({ ...s, [key]: "sending" }));
    try {
      const { data: res, error } = await supabase.functions.invoke("send-payment-instructions", {
        body: { email: l.email, name: l.name || "", plan: l.plan || "teacher" },
      });
      if (error || !res?.ok) throw new Error(error?.message || "failed");
      setSendState(s => ({ ...s, [key]: "sent" }));
    } catch {
      setSendState(s => ({ ...s, [key]: "failed" }));
      setTimeout(() => setSendState(s => ({ ...s, [key]: "idle" })), 3000);
    }
  };

  const PLAN_TAG = { teacher: "מורה ₪59", parent: "הורה ₪19", pro: "פרו", compass: "מצפן ₪49" };
  const grouped = [];
  for (const l of leads) {
    const prev = grouped[grouped.length - 1];
    const key = l.user_id ?? l.email;
    const sameUser = prev && key && (prev.user_id ?? prev.email) === key;
    const closeInTime = prev && Math.abs(new Date(prev.created_at) - new Date(l.created_at)) < 6 * 3600 * 1000;
    if (sameUser && closeInTime) prev.count += 1;
    else grouped.push({ ...l, count: 1 });
  }
  return (
    <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
      <h3 className="font-bold text-ink mb-3 text-sm">🔥 לידים — בקשות שדרוג ({grouped.length})</h3>
      <div className="space-y-2">
        {grouped.map((l, i) => {
          const digits = (l.phone || "").replace(/\D/g, "");
          const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
          const waText = encodeURIComponent(`היי${l.name ? " " + l.name : ""}! 👋 כאן נאור מבשבילי — ראיתי שביקשת לשדרג. אשמח לעזור לך להתחיל 🙂`);
          const key = `${l.email ?? l.user_id ?? "x"}-${i}`;
          const st = sendState[key] ?? "idle";
          return (
            <div key={i} className="bg-canvas rounded-xl p-3">
              <div className="flex justify-between items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {l.name || l.email?.split("@")[0] || "משתמש"}
                    {l.count > 1 && <span className="mr-1.5 text-[10px] bg-brand/15 text-brand rounded-full px-1.5 py-0.5 font-bold">×{l.count} לחיצות</span>}
                  </p>
                  {l.email && <p className="text-xs text-ink/50 truncate" dir="ltr">{l.email}</p>}
                  <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                    {l.plan && <span className="text-[10px] font-semibold bg-magic/10 text-magic rounded-full px-2 py-0.5">{PLAN_TAG[l.plan] ?? l.plan}</span>}
                    {l.method === "bit" && <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">💙 ביט</span>}
                    {l.method === "whatsapp" && <span className="text-[10px] font-semibold bg-green-50 text-green-700 rounded-full px-2 py-0.5">💬 וואטסאפ</span>}
                    <span className="text-[10px] text-ink/35">{fmt(l.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                  {l.email && (
                    <button
                      onClick={() => sendInstructions(key, l)}
                      disabled={st === "sending" || st === "sent"}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        st === "sent" ? "bg-grow/15 text-grow cursor-default"
                        : st === "failed" ? "bg-red-50 text-red-600"
                        : "bg-magic text-white hover:opacity-90 disabled:opacity-60"
                      }`}
                    >
                      {st === "sending" ? "שולח…" : st === "sent" ? "✓ נשלח" : st === "failed" ? "נכשל — נסה שוב" : "📨 שלח הוראות תשלום"}
                    </button>
                  )}
                  {intl.length >= 11 && (
                    <a href={`https://wa.me/${intl}?text=${waText}`} target="_blank" rel="noopener noreferrer"
                      className="bg-[#25D366] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity font-semibold">
                      💬 וואטסאפ
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-ink/35 mt-2">📨 "שלח הוראות תשלום" — מייל ממותג מוכן: הסכום לפי התוכנית, מספר הביט, וקישור וואטסאפ לצילום ההעברה.</p>
    </div>
  );
}
