import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: opt a user out of marketing email by their address, so the admin
// can honor an unsubscribe request from the panel without touching the DB.

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Authorize: admin-plan caller only.
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized" }, 401);
  const { data: caller } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (caller?.plan !== "admin") return json({ error: "forbidden" }, 403);

  let email = "";
  try { email = String((await req.json())?.email ?? "").trim().toLowerCase(); } catch { /* no body */ }
  if (!email || !email.includes("@")) return json({ ok: false, error: "כתובת מייל לא תקינה" }, 400);

  try {
    // Map email → user id (auth.users isn't directly queryable via PostgREST).
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!match) return json({ ok: false, found: false, error: "לא נמצא משתמש עם המייל הזה" });

    await admin.from("profiles").update({ unsubscribed_at: new Date().toISOString() }).eq("id", match.id);
    return json({ ok: true, found: true, email });
  } catch (e) {
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
