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
      // Email one-click. Preferred: ?t=<unsubscribe_token>&q=..&a=.. — the token is
      // unguessable, so answers can't be forged for arbitrary users. Legacy links
      // (?uid=<auth uid>) from already-sent emails keep working.
      const url = new URL(req.url);
      questionKey  = url.searchParams.get("q")   ?? "";
      answer       = url.searchParams.get("a")   ?? "";
      triggerContext = url.searchParams.get("ctx") ?? null;
      const token = url.searchParams.get("t") ?? "";
      if (token) {
        const { data: p } = await admin
          .from("profiles").select("id").eq("unsubscribe_token", token).maybeSingle();
        userId = p?.id ?? "";
      } else {
        userId = url.searchParams.get("uid") ?? "";
      }
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

    // Validate before the service-role write: the GET path is unauthenticated
    // (one-click from email), so without these checks anyone can write arbitrary
    // unbounded strings into survey_responses for any uid.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Every question_key a caller links to MUST be listed here — answers to
    // unlisted keys are silently dropped (that's how the monthly_need/barrier
    // one-click links from send-followup-emails were lost for months).
    const VALID_QUESTIONS: Record<string, string[]> = {
      use_case:     ["private_lessons", "full_class", "homework"],
      monthly_need: ["up_to_5", "five_to_15", "twenty_plus"],
      barrier:      ["no_time", "didnt_understand", "no_topic"],
    };
    const validAnswers = VALID_QUESTIONS[questionKey];
    if (!UUID_RE.test(userId) || !validAnswers || !validAnswers.includes(answer)) {
      return isGet
        ? Response.redirect(SITE_URL, 302)
        : new Response(JSON.stringify({ error: "invalid fields" }), { status: 400, headers: CORS });
    }
    if (triggerContext) triggerContext = String(triggerContext).slice(0, 100);

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
