import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { adminStats, adminSetPaid } from "../compass/api";
import { Shell, Btn, CompassMark } from "../compass/ui";
import { STAGES } from "../compass/data/questions";

// מצפן — admin dashboard at /admin. Access requires login with an account
// whose profiles.plan is 'admin'; the Edge Function verifies this server-side
// on every call, this screen is just the window.

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, `${s.icon ?? ""} ${s.label}`.trim()]));

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [actMsg, setActMsg] = useState(null); // {ok, text}
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: d }) => { setSession(d.session); setAuthLoading(false); })
      .catch(() => setAuthLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    setError("");
    try {
      setData(await adminStats());
    } catch (e) {
      setError(e.code === "forbidden" ? "החשבון הזה אינו אדמין" : "שגיאה בטעינת הנתונים — נסה לרענן");
    }
  };

  useEffect(() => { if (session) load(); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const activate = async (paid) => {
    if (!email.trim()) return;
    setBusy(true);
    setActMsg(null);
    try {
      const r = await adminSetPaid(email.trim(), paid);
      setActMsg({ ok: true, text: paid ? `✓ ${r.email} הופעל — הדוח פתוח עבורו` : `✓ ${r.email} כובה` });
      setEmail("");
      load();
    } catch (e) {
      setActMsg({ ok: false, text: e.code === "user_not_found" ? "לא נמצא משתמש עם המייל הזה (הוא חייב להתחבר לאתר קודם)" : "שגיאה — נסה שוב" });
    } finally {
      setBusy(false);
    }
  };

  // ── Login gate (magic link to /admin) ──
  if (!session) {
    if (authLoading) return <Shell><div className="flex-1 flex items-center justify-center"><CompassMark size={44} className="animate-spin [animation-duration:3s]" /></div></Shell>;
    return <AdminLogin />;
  }

  return (
    <Shell wide>
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CompassMark size={28} />
          <span className="font-bold font-display">מצפן · ניהול</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{session.user?.email}</span>
          <button onClick={load} className="hover:text-white/80">↻ רענון</button>
          <button onClick={() => supabase.auth.signOut()} className="hover:text-white/80">יציאה</button>
        </div>
      </header>

      {error && <p className="text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm mb-4">{error}</p>}

      {/* Activation box — the daily workflow: someone paid on Bit → activate here */}
      <section className="bg-gradient-to-br from-grow/15 to-magic/10 border border-grow/40 rounded-3xl p-5 mb-6">
        <h2 className="font-bold mb-1">💳 הפעלת לקוח ששילם</h2>
        <p className="text-xs text-white/45 mb-3">קיבלת ביט + וואטסאפ? הדבק את המייל שלו — והדוח נפתח לו מיד.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && activate(true)}
            placeholder="customer@email.com"
            className="flex-1 min-w-[220px] bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 outline-none focus:border-grow transition-colors text-center"
          />
          <Btn onClick={() => activate(true)} disabled={busy || !email.trim()}>הפעל תשלום ✓</Btn>
          <Btn ghost onClick={() => activate(false)} disabled={busy || !email.trim()}>כבה</Btn>
        </div>
        {actMsg && <p className={`text-sm mt-2 ${actMsg.ok ? "text-grow" : "text-red-300"}`}>{actMsg.text}</p>}
      </section>

      {!data ? (
        <div className="flex items-center gap-2 text-white/40 text-sm"><CompassMark size={20} className="animate-spin [animation-duration:3s]" /> טוען נתונים…</div>
      ) : (
        <>
          {/* Stats */}
          <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: "מסעות (24 שע׳)", value: data.stats.today },
              { label: "סה\"כ מסעות", value: data.stats.total_journeys },
              { label: "דוחות הושלמו", value: data.stats.completed },
              { label: "לקוחות משלמים", value: data.stats.paid_users },
              { label: "הכנסות משוערות", value: `₪${data.stats.revenue_estimate}` },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold font-display text-brand">{s.value}</div>
                <div className="text-xs text-white/45 mt-1">{s.label}</div>
              </div>
            ))}
          </section>

          {/* Funnel */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">
            <h2 className="font-bold mb-3">📊 איפה אנשים נמצאים במסע</h2>
            <div className="space-y-2">
              {STAGES.filter((s) => data.funnel[s.id]).map((s) => {
                const n = data.funnel[s.id];
                const max = Math.max(...Object.values(data.funnel), 1);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="w-36 text-white/60 flex-shrink-0">{STAGE_LABEL[s.id]}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-l from-brand to-magic" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-left font-bold">{n}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-white/35 mt-3">
              💡 מי שתקוע ב"הפקת הדוח" — שילם אולי ומחכה להפעלה, או מתלבט. אלה האנשים לפולו-אפ בוואטסאפ.
            </p>
          </section>

          {/* Journeys table */}
          <section className="bg-white/5 border border-white/10 rounded-3xl p-5">
            <h2 className="font-bold mb-3">🧭 מסעות אחרונים</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs border-b border-white/10">
                    <th className="text-right py-2 pl-3">מייל</th>
                    <th className="text-right py-2 pl-3">שלב</th>
                    <th className="text-right py-2 pl-3">שילם</th>
                    <th className="text-right py-2 pl-3">קריאות AI</th>
                    <th className="text-right py-2">עדכון אחרון</th>
                  </tr>
                </thead>
                <tbody>
                  {data.journeys.map((j, i) => (
                    <tr key={i} className="border-b border-white/5 text-white/75">
                      <td className="py-2 pl-3" dir="ltr" style={{ textAlign: "right" }}>{j.email}</td>
                      <td className="py-2 pl-3">{STAGE_LABEL[j.stage] ?? j.stage}{j.status === "completed" ? " ✓" : ""}</td>
                      <td className="py-2 pl-3">{j.paid ? <span className="text-grow font-bold">✓</span> : <span className="text-white/25">—</span>}</td>
                      <td className="py-2 pl-3">{j.ai_calls}</td>
                      <td className="py-2 text-white/45 text-xs">{fmtDate(j.updated_at)}</td>
                    </tr>
                  ))}
                  {data.journeys.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-white/35">עוד אין מסעות — שתף את הלינק 🚀</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const send = async () => {
    if (!email.trim()) return;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    }).catch(() => {});
    setSent(true);
  };
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <CompassMark size={48} className="mb-4" />
        <h1 className="text-xl font-bold font-display mb-4">מצפן · כניסת ניהול</h1>
        {sent ? (
          <p className="text-white/60 text-sm">✉️ נשלח קישור ל־{email}</p>
        ) : (
          <div className="w-full max-w-xs space-y-3">
            <input
              dir="ltr" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="admin email"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-magic text-center"
            />
            <Btn onClick={send} className="w-full" disabled={!email.trim()}>שלח קישור כניסה</Btn>
          </div>
        )}
      </div>
    </Shell>
  );
}
