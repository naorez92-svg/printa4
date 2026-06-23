import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Verify caller is admin
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

  const { data: callerProfile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (callerProfile?.plan !== "admin") {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch all in parallel
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
    admin.from("booklets").select("user_id, title, world, goal, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const users = authData?.users ?? [];
  const usersThisWeek = users.filter(u => u.created_at >= weekAgo).length;
  const usersToday = users.filter(u => u.created_at >= todayStart).length;

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

  // Top topics — normalize goal text to a short label
  const topicCount: Record<string, number> = {};
  (allBookletRows ?? []).forEach(b => {
    const raw = (b.goal ?? b.world ?? "").trim();
    if (!raw) return;
    // Take first ~40 chars as the label (trim at last space to avoid mid-word cuts)
    const label = raw.length > 40 ? raw.substring(0, 40).replace(/\s\S*$/, "") + "…" : raw;
    topicCount[label] = (topicCount[label] ?? 0) + 1;
  });
  const topTopics = Object.entries(topicCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

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

  return new Response(JSON.stringify({
    totalUsers: users.length,
    usersThisWeek,
    usersToday,
    totalBooklets: totalBooklets ?? 0,
    bookletsThisWeek: bookletsThisWeek ?? 0,
    bookletsToday: bookletsToday ?? 0,
    bookletsThisMonth: bookletsThisMonth ?? 0,
    planBreakdown,
    topTopics,
    recentUsers,
    recentFeedback: recentFeedback ?? [],
    recentLeads: recentLeads ?? [],
  }), { headers: { ...cors, "content-type": "application/json" } });
});
