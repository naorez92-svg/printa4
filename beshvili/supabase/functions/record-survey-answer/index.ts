import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SITE_URL = "https://www.beshvili.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    let userId: string;
    let questionKey: string;
    let answer: string;
    let triggerContext: string | null = null;
    const isGet = req.method === "GET";

    if (isGet) {
      // Email one-click: ?uid=xxx&q=use_case&a=private_lessons&ctx=email_created_one
      const url = new URL(req.url);
      userId       = url.searchParams.get("uid") ?? "";
      questionKey  = url.searchParams.get("q")   ?? "";
      answer       = url.searchParams.get("a")   ?? "";
      triggerContext = url.searchParams.get("ctx") ?? null;
    } else {
      // In-app POST with JWT
      const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
      const { data: { user }, error } = await admin.auth.getUser(jwt);
      if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
      userId = user.id;
      const body = await req.json();
      questionKey    = body.question_key    ?? "";
      answer         = body.answer          ?? "";
      triggerContext = body.trigger_context ?? null;
    }

    if (!userId || !questionKey || !answer) {
      return isGet
        ? Response.redirect(SITE_URL, 302)
        : new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: CORS });
    }

    // Upsert: one answer per user per question (UNIQUE constraint on user_id, question_key)
    const { error: upsertErr } = await admin.from("survey_responses").upsert(
      { user_id: userId, question_key: questionKey, answer, trigger_context: triggerContext },
      { onConflict: "user_id,question_key" }
    );
    if (upsertErr) console.error("survey upsert error:", upsertErr);

    if (isGet) {
      return Response.redirect(`${SITE_URL}?survey=thanks`, 302);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
    });

  } catch (e) {
    console.error("record-survey-answer error:", e);
    return req.method === "GET"
      ? Response.redirect(SITE_URL, 302)
      : new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: CORS });
  }
});
