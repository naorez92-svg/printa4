import { createClient } from "jsr:@supabase/supabase-js@2";

// Self-test: proves a NON-ADMIN user can create (save) a booklet end-to-end.
// This reproduces the exact path that broke in the 0024→0026 trigger regression:
// it signs in as a throwaway free-plan user and INSERTs a booklet through
// PostgREST with that user's JWT, so the full trigger chain (quota +
// lifetime-counter + prevent_plan_self_update guard) runs in real user context —
// something a service-role insert can NOT reproduce (auth.uid() would be null).
//
// Returns { ok: true } only if a real user insert succeeds. Cleans up after itself.

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
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

  const url        = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Authorize: admin-plan caller only.
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ error: "unauthorized" }, 401);
  const { data: prof } = await admin.from("profiles").select("plan").eq("id", user.id).single();
  if (prof?.plan !== "admin") return json({ error: "forbidden" }, 403);

  const steps: string[] = [];
  let testUserId: string | null = null;
  try {
    // Best-effort sweep: remove any orphaned test users left by a prior run whose
    // cleanup failed, so throwaway accounts can never accumulate over time.
    try {
      const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
      for (const u of existing?.users ?? []) {
        if (u.email?.startsWith("selftest.") && u.email.endsWith("@beshvili.com")) {
          await admin.auth.admin.deleteUser(u.id).catch(() => {});
        }
      }
    } catch { /* sweep is best-effort */ }

    const email    = `selftest.${Date.now()}@beshvili.com`;
    const password = `${crypto.randomUUID()}Aa1!`;

    // 1. Create a throwaway free-plan user (no email is sent — email_confirm marks it verified).
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cErr || !created?.user) return json({ ok: false, stage: "create_user", error: cErr?.message ?? "no user", steps });
    testUserId = created.user.id;
    steps.push("✓ נוצר משתמש בדיקה (free)");

    // 2. Sign in as the test user to obtain a real user JWT.
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error: sErr } = await anon.auth.signInWithPassword({ email, password });
    if (sErr || !signIn?.session) {
      await admin.auth.admin.deleteUser(testUserId);
      return json({ ok: false, stage: "sign_in", error: sErr?.message ?? "no session", steps });
    }
    steps.push("✓ התחברות כמשתמש הבדיקה");

    // 2.5 Generate a REAL booklet through the function (no-stream mode) — tests
    //     the whole pipeline end-to-end: auth + quota + rate-limit + Anthropic +
    //     the in-app no-stream path. This is the path real users actually hit.
    let genHtml = "";
    try {
      const genResp = await fetch(`${url}/functions/v1/generate-booklet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${signIn.session.access_token}`, "apikey": anonKey },
        body: JSON.stringify({ freeText: "דף תרגול קצר בחיבור עד 20 לכיתה א", pageCount: 1, withAnswerKey: false, noStream: true }),
      });
      if (!genResp.ok) {
        const eb = await genResp.json().catch(() => ({}));
        await admin.auth.admin.deleteUser(testUserId);
        return json({ ok: false, stage: "generate", error: (eb as { error?: string })?.error ?? `HTTP ${genResp.status}`, steps });
      }
      genHtml = ((await genResp.json()) as { html?: string })?.html ?? "";
      if (!genHtml.includes("<")) {
        await admin.auth.admin.deleteUser(testUserId);
        return json({ ok: false, stage: "generate", error: "התקבל HTML ריק מהפונקציה", steps });
      }
      steps.push(`✓ יצירת חוברת אמיתית דרך הפונקציה (Anthropic) — ${genHtml.length.toLocaleString()} תווים`);
    } catch (genErr) {
      await admin.auth.admin.deleteUser(testUserId);
      return json({ ok: false, stage: "generate", error: String(genErr instanceof Error ? genErr.message : genErr), steps });
    }

    // 3. Insert the generated booklet AS THE USER — the exact path that broke.
    //    Fires the full trigger chain (quota + lifetime counter +
    //    prevent_plan_self_update guard) with auth.uid() = the test user.
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });
    const { data: ins, error: insErr } = await userClient
      .from("booklets")
      .insert({ user_id: testUserId, title: "🧪 self-test", goal: "self-test", level: "medium", html: genHtml })
      .select("id")
      .single();

    const ok = !insErr;
    steps.push(ok ? "✓ יצירת חוברת בתור משתמש רגיל הצליחה" : `✗ יצירת חוברת נכשלה: ${insErr!.message}`);

    // 4. Cleanup — deleting the user cascades the test booklet (FK on delete cascade).
    await admin.auth.admin.deleteUser(testUserId);
    steps.push("✓ ניקוי — משתמש הבדיקה נמחק");

    return json({ ok, insert_error: insErr?.message ?? null, booklet_id: ins?.id ?? null, steps });
  } catch (e) {
    if (testUserId) { try { await admin.auth.admin.deleteUser(testUserId); } catch { /* best effort */ } }
    return json({ ok: false, error: String(e instanceof Error ? e.message : e), steps });
  }
});
