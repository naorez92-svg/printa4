import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "—";

export default function AdminPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState("");
  const [sendingRenewal, setSendingRenewal] = useState(false);
  const [renewalResult, setRenewalResult] = useState("");

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await supabase.functions.invoke("admin-stats");
      if (err) setError(err.message);
      else setData(res);
      setLoading(false);
    })();
  }, []);

  const triggerRenewal = async () => {
    setSendingRenewal(true);
    setRenewalResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-renewal-reminder", { body: {} });
    setSendingRenewal(false);
    if (err) setRenewalResult(`שגיאה: ${err.message}`);
    else setRenewalResult(`נשלחו ${res?.sent ?? 0} תזכורות מתוך ${res?.total ?? 0}`);
  };

  const triggerFollowup = async () => {
    setSending(true);
    setSendResult("");
    const { data: res, error: err } = await supabase.functions.invoke("send-followup", { body: {} });
    setSending(false);
    if (err) setSendResult(`שגיאה: ${err.message}`);
    else setSendResult(`נשלחו ${res?.sent ?? 0} מיילים מתוך ${res?.total ?? 0}`);
  };

  if (loading) return <div className="text-center py-12 text-ink/40">טוען נתוני ניהול…</div>;
  if (error) return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;
  if (!data) return null;

  const statCards = [
    { label: "סה״כ משתמשים", value: data.totalUsers, icon: "👥" },
    { label: "השבוע", value: data.usersThisWeek, icon: "📅" },
    { label: "היום", value: data.usersToday, icon: "⚡" },
    { label: "סה״כ חוברות", value: data.totalBooklets, icon: "📚" },
    { label: "חוברות השבוע", value: data.bookletsThisWeek, icon: "📊" },
    { label: "חוברות היום", value: data.bookletsToday, icon: "🔥" },
  ];

  return (
    <div className="space-y-6">
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

      {/* Plan breakdown */}
      <div className="bg-white rounded-2xl p-4 border border-ink/5 shadow-sm">
        <h3 className="font-bold text-ink mb-3 text-sm">פילוח תוכניות</h3>
        <div className="flex gap-4 text-sm">
          {Object.entries(data.planBreakdown ?? {}).map(([plan, count]) => (
            <span key={plan} className={`px-3 py-1 rounded-full text-xs font-medium ${
              plan === "pro" ? "bg-magic/10 text-magic" :
              plan === "admin" ? "bg-brand/10 text-brand" :
              "bg-canvas text-ink/50"
            }`}>
              {plan}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Popular topics analytics */}
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
                      <div
                        className="h-full bg-gradient-to-r from-brand to-magic rounded-full"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
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
        {/* Follow-up trigger */}
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5">
          <h3 className="font-bold text-ink mb-1 text-sm">פולואפ D+2</h3>
          <p className="text-xs text-ink/40 mb-3">אוטומטי דרך GitHub Actions. אפשר ידנית.</p>
          <button
            onClick={triggerFollowup}
            disabled={sending}
            className="bg-magic text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full"
          >
            {sending ? "שולח…" : "שלח עכשיו ✉️"}
          </button>
          {sendResult && <p className="text-xs text-grow mt-2">{sendResult}</p>}
        </div>

        {/* Renewal reminder trigger */}
        <div className="bg-canvas rounded-2xl p-4 border border-ink/5">
          <h3 className="font-bold text-ink mb-1 text-sm">תזכורת חידוש D+25</h3>
          <p className="text-xs text-ink/40 mb-3">מזכיר לפרו לחדש 5 ימים לפני הסוף.</p>
          <button
            onClick={triggerRenewal}
            disabled={sendingRenewal}
            className="bg-brand text-white rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity w-full"
          >
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
                <th className="text-right pb-2 pr-1">כניסה אחרונה</th>
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
                  <td className="py-1.5 pr-1 text-ink/50">{fmtDate(u.lastSignIn)}</td>
                  <td className="py-1.5 pr-1">
                    <span className={`font-bold ${u.bookletCount === 0 ? "text-red-400" : "text-grow"}`}>
                      {u.bookletCount}
                    </span>
                  </td>
                  <td className="py-1.5 pr-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      u.plan === "pro" ? "bg-magic/10 text-magic" :
                      u.plan === "admin" ? "bg-brand/10 text-brand" :
                      "bg-canvas text-ink/40"
                    }`}>{u.plan}</span>
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
                  <a
                    href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#25D366] text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
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
