import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const fmt     = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "—";
const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

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

  const [sending, setSending]           = useState(false);
  const [sendResult, setSendResult]     = useState("");
  const [sendingRenewal, setSendingRenewal] = useState(false);
  const [renewalResult, setRenewalResult]   = useState("");

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await supabase.functions.invoke("admin-stats");
      if (err) setError(err.message);
      else {
        setData(res);
        setProposals(res?.proposals ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const handleProposal = async (id, status, proposal = null) => {
    await supabase.from("proposals").update({
      status,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    setProposals(prev => prev.filter(p => p.id !== id));
    if (status === "approved" && proposal?.action_type === "whatsapp") {
      const msg   = encodeURIComponent(proposal.action_payload?.message ?? "");
      const phone = proposal.action_payload?.phone ?? "972509139137";
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    }
  };

  const regenerateProposals = async () => {
    setRegenerating(true);
    const { data: res } = await supabase.functions.invoke("admin-stats", {
      body: { generateProposals: true },
    });
    if (res?.proposals) setProposals(res.proposals);
    setRegenerating(false);
  };

  const triggerFollowup = async () => {
    setSending(true); setSendResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: {} });
    setSending(false);
    setSendResult(err ? `שגיאה: ${err.message}` : `נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.total ?? 0}`);
  };

  const triggerRenewal = async () => {
    setSendingRenewal(true); setRenewalResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-renewal-reminder", { body: {} });
    setSendingRenewal(false);
    setRenewalResult(err ? `שגיאה: ${err.message}` : `נשלחו ${res?.sent ?? 0} תזכורות מתוך ${res?.total ?? 0}`);
  };

  if (loading) return <div className="text-center py-12 text-ink/40">טוען נתוני ניהול…</div>;
  if (error)   return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;
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
    { label: "סה״כ משתמשים",  value: data.totalUsers,         icon: "👥" },
    { label: "השבוע",          value: data.usersThisWeek,      icon: "📅" },
    { label: "היום",           value: data.usersToday,         icon: "⚡" },
    { label: "סה״כ חוברות",   value: data.totalBooklets,      icon: "📚" },
    { label: "חוברות השבוע",  value: data.bookletsThisWeek,   icon: "📊" },
    { label: "חוברות היום",   value: data.bookletsToday,      icon: "🔥" },
  ];

  const fs = data.funnelStats ?? { sessions: 0, started: 0, completed: 0, upgradeOpened: 0, ctaClicked: 0, leads: 0 };
  const convStart = fs.sessions > 0 ? Math.round((fs.started / fs.sessions) * 100) : 0;
  const convDone  = fs.started  > 0 ? Math.round((fs.completed / fs.started) * 100) : 0;
  // Upgrade funnel: saw paywall → clicked pay → became a lead.
  // Clamp to 100%: the modal also opens from non-completion paths (dashboard/quota),
  // so upgradeOpened can exceed completed — a raw ratio would read >100%.
  const convCta  = fs.upgradeOpened > 0 ? Math.min(100, Math.round(((fs.ctaClicked ?? 0) / fs.upgradeOpened) * 100)) : 0;
  const convLead = fs.completed     > 0 ? Math.min(100, Math.round(((fs.upgradeOpened ?? 0) / fs.completed) * 100)) : 0;

  // Full-funnel analytics (anonymous → signup → activation + virality + reliability)
  const an = data.analytics ?? {
    visitors: 0, signups: 0, logins: 0, activated: 0, emailSubmitted: 0, verifyView: 0,
    googleClicks: 0, shares: 0, publicViews: 0, prints: 0, pwaInstalls: 0, ratings: 0,
    feedbacks: 0, sources: [], errors: [], paywallHits: 0, totalEvents: 0,
  };
  const pct = (num, den) => (den > 0 ? Math.min(100, Math.round((num / den) * 100)) : 0);
  const convVisitSignup  = pct(an.signups, an.visitors);
  const convSignupActive = pct(an.activated, an.signups + an.logins);
  const errorTotal = (an.errors ?? []).reduce((s, e) => s + e.count, 0);

  return (
    <div className="space-y-6">

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

      {/* Upgrade funnel (last 7 days) — the conversion step that was previously invisible */}
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

      {/* ── FULL FUNNEL ANALYTICS (last 7 days) ─────────────────────────── */}
      {an.totalEvents > 0 ? (
        <div className="space-y-4">
          {/* Acquisition → activation */}
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

          {/* Traffic sources + virality/engagement side by side */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Traffic sources */}
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

            {/* Virality + engagement */}
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

          {/* Generation reliability — errors by type */}
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

      {/* Dormant users — created booklets but stopped: highest-value retention targets */}
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
            משתמשים חינם שהגיעו ל-3 חוברות — הכי קרובים להמרה
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

      {/* Plan breakdown + conversion rate */}
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
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5">
          <h3 className="font-bold text-ink mb-1 text-sm">פולואפ D+2</h3>
          <p className="text-xs text-ink/40 mb-3">אוטומטי דרך GitHub Actions. אפשר ידנית.</p>
          <button onClick={triggerFollowup} disabled={sending}
            className="bg-magic text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full">
            {sending ? "שולח…" : "שלח עכשיו ✉️"}
          </button>
          {sendResult && <p className="text-xs text-grow mt-2">{sendResult}</p>}
        </div>
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5">
          <h3 className="font-bold text-ink mb-1 text-sm">תזכורת חידוש D+25</h3>
          <p className="text-xs text-ink/40 mb-3">מזכיר לפרו לחדש 5 ימים לפני הסוף.</p>
          <button onClick={triggerRenewal} disabled={sendingRenewal}
            className="bg-brand text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full">
            {sendingRenewal ? "שולח…" : "שלח עכשיו 🔄"}
          </button>
          {renewalResult && <p className="text-xs text-grow mt-2">{renewalResult}</p>}
        </div>
      </div>

      {/* Recent users */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">משתמשים אחרונים ({data.recentUsers?.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
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
            <tbody>
              {(data.recentUsers ?? []).map((u) => (
                <tr key={u.id} className="border-b border-ink/5 last:border-0">
                  <td className="py-1.5 pr-1 text-ink/70 font-mono">{u.email}</td>
                  <td className="py-1.5 pr-1 text-ink/50">{fmtDate(u.createdAt)}</td>
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
                      u.plan === "free" && u.bookletCount >= 3 ? "text-brand" :
                      "text-grow"
                    }`}>
                      {u.bookletCount}
                      {u.plan === "free" && u.bookletCount >= 3 ? " ⚡" : ""}
                    </span>
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
              ))}
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

      {/* Recent leads */}
      {data.recentLeads?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
          <h3 className="font-bold text-ink mb-3 text-sm">ליידים — בקשות שדרוג ({data.recentLeads.length})</h3>
          <div className="space-y-2">
            {data.recentLeads.map((l, i) => (
              <div key={i} className="flex justify-between items-center bg-canvas rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{l.name || "ללא שם"}</p>
                  <p className="text-xs text-ink/40">{fmt(l.created_at)}</p>
                </div>
                {l.phone && (
                  <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="bg-[#25D366] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                    WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
