import { createClient } from "jsr:@supabase/supabase-js@2";

function getCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    origin === "https://www.beshvili.com" ||
    origin === "https://beshvili.com" ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:4173" ||
    /^https:\/\/printa4-git-[a-z0-9-]+-naor-s-projects\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://www.beshvili.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Verify caller: must be an admin-plan user (JWT verified by Supabase)
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  const { data: callerProfile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (callerProfile?.plan !== "admin") {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }

  // Parse body for flags
  let shouldGenerateProposals = false;
  let shouldGenerateInsight = false;
  try {
    const text = await req.text();
    if (text) {
      const parsed = JSON.parse(text);
      shouldGenerateProposals = parsed.generateProposals === true;
      shouldGenerateInsight = parsed.generateInsight === true;
    }
  } catch {}

  const now = new Date();
  const weekAgo      = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000).toISOString();
  const fourDaysAgo  = new Date(now.getTime() - 4  * 24 * 60 * 60 * 1000).toISOString();
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
    { data: allBookletUserIds },
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
    admin.from("booklets").select("user_id, created_at"),
    admin.from("booklets").select("user_id, title, world, goal, created_at, difficulty_feedback").order("created_at", { ascending: false }).limit(200),
  ]);

  const users = authData?.users ?? [];
  const usersThisWeek = users.filter(u => u.created_at >= weekAgo).length;
  const usersToday    = users.filter(u => u.created_at >= todayStart).length;

  // Profile map
  const profileMap: Record<string, { plan: string; full_name: string | null; followup_sent_at: string | null }> = {};
  (allProfiles ?? []).forEach(p => { profileMap[p.id] = p; });

  // Booklet count + last booklet date per user (from ALL booklets for accurate retention metrics)
  const bookletsByUser: Record<string, number> = {};
  const lastBookletByUser: Record<string, string> = {};
  (allBookletUserIds ?? []).forEach((b: { user_id: string; created_at: string }) => {
    bookletsByUser[b.user_id] = (bookletsByUser[b.user_id] ?? 0) + 1;
    if (!lastBookletByUser[b.user_id] || b.created_at > lastBookletByUser[b.user_id]) {
      lastBookletByUser[b.user_id] = b.created_at;
    }
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

  // Dormant: created 1+ booklets but last one was 4+ days ago — high-value retention targets
  const dormantAll = users.filter(u => {
    const plan = profileMap[u.id]?.plan ?? "free";
    if (plan === "admin") return false;
    const lastBooklet = lastBookletByUser[u.id];
    return (bookletsByUser[u.id] ?? 0) >= 1 && lastBooklet && lastBooklet < fourDaysAgo;
  });
  const dormantCount = dormantAll.length;
  const dormantUsers = dormantAll
    .sort((a, b) => {
      const la = lastBookletByUser[a.id] ?? "";
      const lb = lastBookletByUser[b.id] ?? "";
      return lb > la ? -1 : 1;
    })
    .slice(0, 20)
    .map(u => ({
      email: u.email,
      name: profileMap[u.id]?.full_name ?? null,
      bookletCount: bookletsByUser[u.id] ?? 0,
      lastBookletAt: lastBookletByUser[u.id] ?? null,
      plan: profileMap[u.id]?.plan ?? "free",
    }));

  // Retention metrics
  const FREE_LIMIT_THRESHOLD = 3;
  const totalNonAdminUsers = users.filter(u => (profileMap[u.id]?.plan ?? "free") !== "admin").length;
  const usersWithAnyBooklet = users.filter(u => {
    const plan = profileMap[u.id]?.plan ?? "free";
    return plan !== "admin" && (bookletsByUser[u.id] ?? 0) >= 1;
  }).length;
  const retentionToSecond = users.filter(u => (bookletsByUser[u.id] ?? 0) >= 2).length;
  const retentionToThird  = users.filter(u => (bookletsByUser[u.id] ?? 0) >= FREE_LIMIT_THRESHOLD).length;

  // Free users who hit the free limit — prime upgrade opportunities
  const freeAtLimitAllUsers = users.filter(u => {
    const plan = profileMap[u.id]?.plan ?? "free";
    return plan === "free" && (bookletsByUser[u.id] ?? 0) >= FREE_LIMIT_THRESHOLD;
  });
  const freeAtLimitCount = freeAtLimitAllUsers.length;
  const freeAtLimitUsers = freeAtLimitAllUsers
    .sort((a, b) => (bookletsByUser[b.id] ?? 0) - (bookletsByUser[a.id] ?? 0))
    .slice(0, 20)
    .map(u => ({
      email: u.email,
      name: profileMap[u.id]?.full_name ?? null,
      bookletCount: bookletsByUser[u.id] ?? 0,
      createdAt: u.created_at,
    }));

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
      lastBookletAt: lastBookletByUser[u.id] ?? null,
    }));

  // Funnel + full analytics from events (last 7 days)
  let funnelStats = { sessions: 0, started: 0, completed: 0, upgradeOpened: 0, ctaClicked: 0, leads: 0 };
  let analytics = {
    visitors: 0, signups: 0, logins: 0, activated: 0,           // acquisition → activation
    emailSubmitted: 0, verifyView: 0, googleClicks: 0,          // auth funnel
    shares: 0, publicViews: 0, prints: 0,                       // virality / value
    pwaInstalls: 0, ratings: 0, feedbacks: 0,                   // engagement
    sources: [] as { source: string; visitors: number }[],     // traffic attribution
    errors: [] as { type: string; count: number }[],            // generation failures
    paywallHits: 0,                                              // saw a paywall (any path)
    totalEvents: 0,
  };
  try {
    // Explicit high limit so PostgREST's default ~1000-row cap doesn't silently
    // truncate (and undercount) once anonymous tracking ramps event volume.
    const { data: ev } = await admin
      .from("events")
      .select("event, user_id, anonymous_id, metadata")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(100000);
    if (ev) {
      const uniqUser = (name: string) =>
        new Set(ev.filter(e => e.event === name).map(e => e.user_id).filter(Boolean)).size;
      const uniqAnon = (name: string, pred?: (m: Record<string, unknown>) => boolean) =>
        new Set(ev.filter(e => e.event === name && (!pred || pred(e.metadata ?? {})))
          .map(e => e.anonymous_id).filter(Boolean)).size;
      const countEv = (...names: string[]) => ev.filter(e => names.includes(e.event)).length;

      funnelStats = {
        sessions:      uniqUser("session_start"),
        started:       uniqUser("booklet_started"),
        completed:     uniqUser("booklet_completed"),
        upgradeOpened: uniqUser("upgrade_modal_opened"),
        ctaClicked:    uniqUser("upgrade_cta_clicked"),
        leads:         0, // filled from the leads table below (more reliable than events)
      };

      // Traffic sources from first-touch attribution on landing page-views.
      const landing = ev.filter(e => e.event === "page_view" && (e.metadata as Record<string, unknown>)?.route === "landing");
      const classify = (m: Record<string, unknown>): string => {
        const utm = m.utm_source as string | undefined;
        if (utm) return utm;
        const ref = (m.referrer as string | undefined) ?? "";
        if (!ref) return "direct";
        try {
          const host = new URL(ref).hostname.replace(/^www\./, "");
          if (/wa\.me|whatsapp/.test(host)) return "whatsapp";
          if (/google\./.test(host)) return "google";
          if (/facebook|fb\.com/.test(host)) return "facebook";
          if (/instagram/.test(host)) return "instagram";
          if (/beshvili/.test(host)) return "internal";
          return host;
        } catch { return "direct"; }
      };
      const sourceMap: Record<string, Set<string>> = {};
      for (const e of landing) {
        const src = classify((e.metadata ?? {}) as Record<string, unknown>);
        (sourceMap[src] ??= new Set()).add(e.anonymous_id ?? "");
      }

      // Generation errors grouped by type.
      const errMap: Record<string, number> = {};
      for (const e of ev.filter(e => e.event === "booklet_error")) {
        const t = ((e.metadata as Record<string, unknown>)?.type as string) ?? "unknown";
        errMap[t] = (errMap[t] ?? 0) + 1;
      }

      analytics = {
        visitors:       uniqAnon("page_view", m => m.route === "landing"),
        signups:        uniqUser("signup_completed"),
        logins:         uniqUser("login_completed"),
        activated:      uniqUser("booklet_completed"),
        emailSubmitted: uniqAnon("auth_email_submitted"),
        verifyView:     uniqAnon("auth_verify_screen_view"),
        googleClicks:   countEv("auth_google_click"),
        shares:         countEv("booklet_shared_whatsapp", "share_link_copied", "public_booklet_cta_click"),
        publicViews:    uniqAnon("public_booklet_view"),
        prints:         countEv("booklet_printed", "public_booklet_print"),
        pwaInstalls:    countEv("pwa_installed", "pwa_install_accepted"),
        ratings:        countEv("booklet_rating_submitted"),
        feedbacks:      countEv("feedback_submitted"),
        paywallHits:    countEv("quota_screen_shown", "page_count_locked_clicked", "upgrade_modal_opened"),
        sources: Object.entries(sourceMap)
          .map(([source, set]) => ({ source, visitors: set.size }))
          .sort((a, b) => b.visitors - a.visitors).slice(0, 8),
        errors: Object.entries(errMap)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        totalEvents: ev.length,
      };
    }
  } catch { /* events table may not exist yet */ }

  // Leads in the last 7 days (purchase-intent count, from the source of truth)
  try {
    const { count: leadCount } = await admin
      .from("leads").select("*", { count: "exact", head: true }).gte("created_at", weekAgo);
    funnelStats.leads = leadCount ?? 0;
  } catch { /* leads table may not exist yet */ }

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
      return plan === "free" && (bookletsByUser[u.id] ?? 0) >= FREE_LIMIT_THRESHOLD;
    });
    if (freeAtLimit.length > 0) {
      newProposals.push({
        agent: "financial",
        title: `${freeAtLimit.length} משתמשים free הגיעו למכסה — פוטנציאל שדרוג`,
        description: `${freeAtLimit.length} משתמשים יצרו ${FREE_LIMIT_THRESHOLD}+ חוברות וסביר שיזדקקו ליותר. בדוק "הזדמנויות שדרוג" בדשבורד לרשימה המלאה.`,
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

  // ── AI strategic insight (on-demand) ──────────────────────────────────────
  // One agent that crunches every metric into a single conclusion: are we on the
  // right track, what does the data mean, and the #1 thing to fix next.
  let insight: Record<string, unknown> | null = null;
  if (shouldGenerateInsight) {
    try {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (apiKey) {
        const PLAN_PRICE: Record<string, number> = { parent: 19, teacher: 59, pro: 30 };
        const mrr = Object.entries(planBreakdown)
          .reduce((s, [plan, n]) => s + (PLAN_PRICE[plan] ?? 0) * (n as number), 0);
        const paidUsers = Object.entries(planBreakdown)
          .reduce((s, [plan, n]) => s + (PLAN_PRICE[plan] ? (n as number) : 0), 0);

        // Compact, factual snapshot — everything the agent reasons over.
        const snapshot = {
          users_total: users.length,
          users_this_week: usersThisWeek,
          non_admin_users: totalNonAdminUsers,
          paid_users: paidUsers,
          mrr_ils: mrr,
          plan_breakdown: planBreakdown,
          booklets_total: totalBooklets ?? 0,
          booklets_this_month: bookletsThisMonth ?? 0,
          activation_made_a_booklet: usersWithAnyBooklet,
          retention_2nd_booklet: retentionToSecond,
          retention_3rd_booklet: retentionToThird,
          churn_risk_users: churnRiskCount,
          dormant_users: dormantCount,
          free_users_at_limit: freeAtLimitCount,
          leads_7d: funnelStats.leads,
          funnel_7d: funnelStats,
          acquisition_7d: {
            visitors: analytics.visitors,
            signups: analytics.signups,
            activated: analytics.activated,
            email_submitted: analytics.emailSubmitted,
          },
          traffic_sources_7d: analytics.sources,
          virality_7d: { shares: analytics.shares, public_views: analytics.publicViews },
          generation_errors_7d: analytics.errors,
          paywall_hits_7d: analytics.paywallHits,
        };

        const sys = `אתה אנליסט מוצר וצמיחה בכיר. נתונים על SaaS ישראלי קטן בשלב מוקדם שמייצר חוברות עבודה לילדים ב-AI (תוכניות: חינם 3 חוברות, הורה 19₪, מורה 59₪). תפקידך: לקמט את כל הנתונים למסקנה אחת ברורה. היה כן, חד, וספציפי — בלי קלישאות. אם הדאטה דלילה מדי למסקנה בטוחה, אמור זאת. החזר אך ורק JSON תקין בלי טקסט מסביב, במבנה: {"direction":"good"|"mixed"|"needs_attention","headline":"משפט אחד שמסכם איפה אנחנו","reading":"2-4 משפטים: מה הנתונים אומרים באמת, מה עובד ומה לא","biggest_lever":"הדבר הבודד הכי חשוב לשפר עכשיו ולמה דווקא הוא","watch":"מדד אחד לעקוב אחריו בשבוע הקרוב"}. כל הטקסט בעברית.`;
        const userMsg = `הנתונים (חלון 7 ימים היכן שמצוין):\n${JSON.stringify(snapshot, null, 2)}`;

        const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: AbortSignal.timeout(60_000),
          headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-opus-4-8",
            max_tokens: 1500,
            system: sys,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
        if (aiResp.ok) {
          const data = await aiResp.json();
          const textOut = (data?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
          const fallback = { direction: "mixed", headline: textOut.slice(0, 200), reading: textOut, biggest_lever: "", watch: "" };
          const jsonMatch = textOut.match(/\{[\s\S]*\}/);
          try {
            insight = jsonMatch ? JSON.parse(jsonMatch[0]) : fallback;
          } catch {
            insight = fallback; // model emitted prose with a stray brace — show the text
          }
          (insight as Record<string, unknown>).generated_at = new Date().toISOString();
        } else {
          console.error("insight AI error:", await aiResp.text());
        }
      }
    } catch (e) {
      console.error("insight generation failed:", e);
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
    analytics,
    insight,
    difficultyBreakdown,
    ratedBooklets,
    churnRiskCount,
    totalNonAdminUsers,
    usersWithAnyBooklet,
    retentionToSecond,
    retentionToThird,
    freeAtLimitCount,
    freeAtLimitUsers,
    dormantCount,
    dormantUsers,
    proposals: pendingProposals,
  }), { headers: { ...cors, "content-type": "application/json" } });
});
