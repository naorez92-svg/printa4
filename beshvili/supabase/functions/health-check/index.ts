import { createClient } from "jsr:@supabase/supabase-js@2";

// Callable only with service role key — used by GitHub Actions health-check cron.
// Returns HTTP 200 + { ok: true }  when everything is fine.
// Returns HTTP 500 + { ok: false, failed: [...] } when any check fails.
// GitHub Actions creates a repo issue on 500, so every failure is visible immediately.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!token || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  type Check = { name: string; ok: boolean; msg?: string };
  const checks: Check[] = [];
  let allOk = true;

  const fail = (name: string, msg: string) => { checks.push({ name, ok: false, msg }); allOk = false; };
  const pass = (name: string, msg?: string) => checks.push({ name, ok: true, msg });

  // ── 1. Secrets ────────────────────────────────────────────────────────────
  if (!Deno.env.get("RESEND_API_KEY"))    fail("RESEND_API_KEY",    "not configured — emails will fail");
  else                                     pass("RESEND_API_KEY");

  if (!Deno.env.get("ANTHROPIC_API_KEY")) fail("ANTHROPIC_API_KEY", "not configured — booklet generation will fail");
  else                                     pass("ANTHROPIC_API_KEY");

  // ── 2. DB connectivity + schema ───────────────────────────────────────────
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  // profiles: check all columns that Edge Functions depend on
  const { error: profileErr } = await admin
    .from("profiles")
    .select("id, plan, followup_sent_at, dormant_followup_sent_at, pro_since, renewal_reminder_sent_at")
    .limit(1);
  if (profileErr) fail("profiles_schema", profileErr.message + " — run migration 0020");
  else            pass("profiles_schema");

  // booklets
  const { error: bookletErr } = await admin
    .from("booklets")
    .select("id, user_id, html, created_at")
    .limit(1);
  if (bookletErr) fail("booklets_table", bookletErr.message);
  else            pass("booklets_table");

  // leads
  const { error: leadsErr } = await admin
    .from("leads")
    .select("id")
    .limit(1);
  if (leadsErr) fail("leads_table", leadsErr.message);
  else          pass("leads_table");

  // ── 3. Recent stream-error rate (last 2 hours) ────────────────────────────
  // Only alert if >50% of generation attempts failed (needs ≥5 attempts to be meaningful)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await admin
    .from("events")
    .select("event_name")
    .in("event_name", ["booklet_started", "booklet_error"])
    .gte("created_at", twoHoursAgo);

  if (recentEvents && recentEvents.length >= 5) {
    const started   = recentEvents.filter(e => e.event_name === "booklet_started").length;
    const errors    = recentEvents.filter(e => e.event_name === "booklet_error").length;
    const errorRate = started > 0 ? Math.round((errors / started) * 100) : 0;
    if (started >= 5 && errorRate > 50) {
      fail("stream_error_rate", `${errorRate}% error rate in last 2h — ${errors}/${started} generation attempts failed`);
    } else {
      pass("stream_error_rate", `${errorRate}% (${errors}/${started})`);
    }
  } else {
    pass("stream_error_rate", "insufficient data — less than 5 attempts in last 2h");
  }

  const result = { ok: allOk, checks, ts: new Date().toISOString() };
  return new Response(JSON.stringify(result, null, 2), {
    status: allOk ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
});
