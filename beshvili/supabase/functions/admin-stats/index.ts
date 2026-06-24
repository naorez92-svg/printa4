import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Verify caller: service role key (cron/CI) OR admin user JWT
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let isServiceRole = false;
  if (jwt === serviceRoleKey) {
    isServiceRole = true;
  } else {
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: callerProfile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
    if (callerProfile?.plan !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }
  }

  // Parse body for flags
  let shouldGenerateProposals = false;
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text);
      shouldGenerateProposals = parsed.generateProposals === true;
    }
  } catch {}

  const now = new Date();
  const weekAgo      = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch all core data in parallel
  const [
    { data: authData },
    { count: totalBooklets },
    { count: bookletsThisWeek },
    { count: bookletsToday },
    { count: bookletsThisMonth },
    { data: allProfiles },
    { data: recentFeedback },
    { data: recentLeads },
    { data: allBookletRows },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("booklets").select("*", { count: "exact", head: true }),
    admin.from("booklets").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    admin.from("booklets").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    admin.from("booklets").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    admin.from("profiles").select("id, plan, full_name, created_at, followup_sent_at"),
    admin.from("feedback").select("message, created_at, user_id").order("created_at", { ascending: false }).limit(15),
    admin.from("leads").select("name, phone, created_at").order("created_at", { ascending: false }).limit(15),
    admin.from("booklets").select("user_id, title, world, goal, created_at, difficulty_feedback").order("created_at", { ascending: false }).limit(200),
  ]);

  const users = authData?.users ?? [];
  const usersThisWeek = users.filter(u => u.created_at >= weekAgo).length;
  const usersToday    = users.filter(u => u.created_at >= todayStart).length;

  // Profile map
  const profileMap: Record<string, { plan: string; full_name: string | null; followup_sent_at: string | null }> = {};
  (allProfiles ?? []).forEach(p => { profileMap[p.id] = p; });

  // Booklet count per user
  const bookletsByUser: Record<string, number> = {};
  (allBookletRows ?? []).forEach(b => {
    bookletsByUser[b.user_id] = (bookletsByUser[b.user_id] ?? 0) + 1;
  });

  const planBreakdown: Record<string, number> = {};
  (allProfiles ?? []).forEach(p => {
    const plan = p.plan ?? "free";
    planBreakdown[plan] = (planBreakdown[plan] ?? 0) + 1;
  });

  // Top topics
  const topicCount: Record<string, number> = {};
  (allBookletRows ?? []).forEach(b => {
    const raw = (b.goal ?? b.world ?? "").trim();
    if (!raw) return;
    const label = raw.length > 40 ? raw.substring(0, 40).replace(/\s\S*$/, "") + "…" : raw;
    topicCount[label] = (topicCount[label] ?? 0) + 1;
  });
  const topTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // Difficulty feedback breakdown (from recent 200 booklets)
  const difficultyBreakdown: Record<string, number> = {};
  (allBookletRows ?? []).forEach(b => {
    if (b.difficulty_feedback) {
      difficultyBreakdown[b.difficulty_feedback] = (difficultyBreakdown[b.difficulty_feedback] ?? 0) + 1;
    }
  });
  const ratedBooklets = (Object.values(difficultyBreakdown) as number[]).reduce((s, n) => s + n, 0);

  // Churn risk: registered 3+ days ago, 0 booklets, non-admin
  const churnRiskCount = users.filter(u => {
    const plan = profileMap[u.id]?.plan ?? "free";
    return plan !== "admin" && u.created_at < threeDaysAgo && (bookletsByUser[u.id] ?? 0) === 0;
  }).length;

  const recentUsers = users
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30)
    .map(u => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      bookletCount: bookletsByUser[u.id] ?? 0,
      plan: profileMap[u.id]?.plan ?? "free",
      name: profileMap[u.id]?.full_name,
      followupSent: profileMap[u.id]?.followup_sent_at,
    }));

  // Funnel stats from events (last 7 days)
  let funnelStats = { sessions: 0, started: 0, completed: 0 };
  try {
    const { data: eventsData } = await admin
      .from("events")
      .select("event, user_id")
      .gte("created_at", weekAgo);
    if (eventsData) {
      funnelStats = {
        sessions:  [...new Set(eventsData.filter(e => e.event === "session_start").map(e => e.user_id))].length,
        started:   [...new Set(eventsData.filter(e => e.event === "booklet_started").map(e => e.user_id))].length,
        completed: [...new Set(eventsData.filter(e => e.event === "booklet_completed").map(e => e.user_id))].length,
      };
    }
  } catch { /* events table may not exist yet */ }

  // Load existing pending proposals
  let pendingProposals: any[] = [];
  try {
    const { data } = await admin
      .from("proposals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    pendingProposals = data ?? [];
  } catch { /* proposals table may not exist yet */ }

  // Generate new proposals (called from cron at 8am)
  if (shouldGenerateProposals) {
    const PLAN_PRICE: Record<string, number> = { parent: 19, teacher: 59, pro: 30 };
    const COST_PER_BOOKLET = 0.80;

    const revenueLines = Object.entries(planBreakdown)
      .filter(([plan]) => PLAN_PRICE[plan] != null)
      .map(([plan, count]) => ({ plan, count: count as number, total: (count as number) * PLAN_PRICE[plan] }));
    const totalMRR  = revenueLines.reduce((s, r) => s + r.total, 0);
    const paidUsers = revenueLines.reduce((s, r) => s + r.count, 0);
    const apiCostNIS = (bookletsThisMonth ?? 0) * COST_PER_BOOKLET;
    const netProfit  = totalMRR - apiCostNIS;

    const newProposals: Array<{
      agent: string; title: string; description: string;
      action_type: string; action_payload: object;
    }> = [];

    // ── Financial agent ──────────────────────────────
    const freeAtLimit = users.filter(u => {
      const plan = profileMap[u.id]?.plan ?? "free";
      return plan === "free" && (bookletsByUser[u.id] ?? 0) >= 2;
    });
    if (freeAtLimit.length > 0) {
      newProposals.push({
        agent: "financial",
        title: `${freeAtLimit.length} משתמשים free הגיעו למכסה — פוטנציאל שדרוג`,
        description: `${freeAtLimit.length} משתמשים יצרו 2+ חוברות וסביר שיזדקקו ליותר. שלח הודעת WhatsApp להצעת שדרוג.`,
        action_type: "whatsapp",
        action_payload: {
          phone: "972509139137",
          message: "שלום! ראיתי שיצרת כמה חוברות יפות עם בשבילי 📚\nאם תרצה ליצור עוד חוברות — יש מנוי הורה ב-19 ₪/חודש (5 חוברות) ומנוי מורה ב-59 ₪/חודש (20 חוברות).\nאשמח לעזור!",
        },
      });
    }
    newProposals.push({
      agent: "financial",
      title: `MRR: ${totalMRR} ₪ · רווח נקי: ${netProfit.toFixed(0)} ₪ · ${paidUsers} מנויים`,
      description: `עלות API החודש: ${apiCostNIS.toFixed(1)} ₪ (${bookletsThisMonth ?? 0} חוברות × 0.80 ₪). ${netProfit >= 0 ? "האפליקציה רווחית ✅" : "הוצאות עולות על הכנסות ⚠️ — בדוק עלויות."}`,
      action_type: "info_only",
      action_payload: {},
    });

    // ── Product agent ────────────────────────────────
    const nonAdminUsers = users.filter(u => (profileMap[u.id]?.plan ?? "free") !== "admin");

    // Churn risk: registered 3+ days ago, still 0 booklets
    const churnUsers = nonAdminUsers.filter(u => u.created_at < threeDaysAgo && (bookletsByUser[u.id] ?? 0) === 0);
    if (churnUsers.length > 2) {
      newProposals.push({
        agent: "product",
        title: `⚠️ ${churnUsers.length} משתמשים בסיכון נטישה — נרשמו 3+ ימים ולא יצרו חוברת`,
        description: `${churnUsers.length} אנשים נרשמו לפני 3+ ימים ועדיין לא יצרו חוברת. ייתכן שיש חסם ב-onboarding. שקול לבדוק את תהליך הכניסה הראשונה ואם צריך — שלח תזכורת ידנית.`,
        action_type: "info_only",
        action_payload: {},
      });
    }

    // Difficulty signal: if >=30% of rated booklets got "too hard"
    const tooHardCount = difficultyBreakdown["too_hard"] ?? 0;
    const tooHardPct   = ratedBooklets >= 10 ? Math.round((tooHardCount / ratedBooklets) * 100) : 0;
    if (tooHardPct >= 30) {
      newProposals.push({
        agent: "product",
        title: `⚠️ ${tooHardPct}% מהחוברות דורגו "קשה מדי" (${tooHardCount}/${ratedBooklets})`,
        description: `מתוך ${ratedBooklets} חוברות שדורגו על ידי המשתמשים, ${tooHardCount} קיבלו "קשה מדי". שקול להנמיך את רמת הקושי בברירת המחדל, או להוסיף בחירת רמה מפורשת בטופס היצירה.`,
        action_type: "info_only",
        action_payload: {},
      });
    }

    if ((recentFeedback ?? []).length > 0) {
      const fbSample = (recentFeedback ?? []).slice(0, 3)
        .map((f: any) => `"${(f.message ?? "").substring(0, 70)}"`)
        .join(" | ");
      newProposals.push({
        agent: "product",
        title: `${(recentFeedback ?? []).length} פידבקים ממתינים לסקירה`,
        description: fbSample,
        action_type: "info_only",
        action_payload: {},
      });
    } else {
      newProposals.push({
        agent: "product",
        title: "אין פידבקים חדשים — הכל שקט 🌟",
        description: "לא התקבלו פידבקים חדשים. אין פעולה נדרשת.",
        action_type: "info_only",
        action_payload: {},
      });
    }

    // ── Health agent ────────────────────────────────
    const avgPerDay   = (bookletsThisWeek ?? 0) / 7;
    const todayCount  = bookletsToday ?? 0;
    if (todayCount === 0 && avgPerDay > 2) {
      newProposals.push({
        agent: "health",
        title: `⚠️ אפס חוברות היום — ממוצע יומי ${avgPerDay.toFixed(1)}`,
        description: "לא נוצרו חוברות היום. בדוק שה-Edge Function generate-booklet פועל תקין.",
        action_type: "info_only",
        action_payload: {},
      });
    } else {
      newProposals.push({
        agent: "health",
        title: `✅ מערכת תקינה — ${todayCount} חוברות היום, ${usersToday} משתמשים חדשים`,
        description: `ממוצע יומי: ${avgPerDay.toFixed(1)} חוברות. הכל פועל כנדרש.`,
        action_type: "info_only",
        action_payload: {},
      });
    }

    // Replace today's pending proposals
    try {
      await admin.from("proposals").delete().eq("status", "pending").gte("created_at", todayStart);
      const { data: inserted } = await admin.from("proposals").insert(newProposals).select("*");
      pendingProposals = inserted ?? [];
    } catch (err) {
      console.error("Failed to upsert proposals:", err);
    }
  }

  return new Response(JSON.stringify({
    totalUsers: users.length,
    usersThisWeek,
    usersToday,
    totalBooklets:     totalBooklets ?? 0,
    bookletsThisWeek:  bookletsThisWeek ?? 0,
    bookletsToday:     bookletsToday ?? 0,
    bookletsThisMonth: bookletsThisMonth ?? 0,
    planBreakdown,
    topTopics,
    recentUsers,
    recentFeedback:     recentFeedback ?? [],
    recentLeads:        recentLeads ?? [],
    funnelStats,
    difficultyBreakdown,
    ratedBooklets,
    churnRiskCount,
    proposals: pendingProposals,
  }), { headers: { ...cors, "content-type": "application/json" } });
});
