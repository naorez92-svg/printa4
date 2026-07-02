import { createClient } from "jsr:@supabase/supabase-js@2";

// Public endpoint for the printed-booklet feedback loop (/f/{share_token}).
// The unguessable share token IS the credential — whoever holds the printed
// page may report how it went. No booklet CONTENT is ever returned from here
// beyond the title line already printed on that page.
//
//   GET  ?token=…   → { title, world, goal, resultCount }  (form header)
//   POST { token, filled_by, difficulty?, mistakes?, hard_text? } → { ok }

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

const TOKEN_RE = /^[0-9a-f-]{36}$/i;
const FILLED_BY = ["student", "parent", "teacher"];
const DIFFICULTY = ["too_hard", "just_right", "too_easy"];
const MISTAKES = ["none", "few", "many"];
// A class is ~35 kids; anything far beyond that on one booklet is abuse.
const MAX_RESULTS_PER_BOOKLET = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token") ?? "";
      if (!TOKEN_RE.test(token)) return json({ error: "invalid_token" }, 400);

      const { data: booklet, error: getErr } = await admin
        .from("booklets")
        .select("title")
        .eq("share_token", token)
        .single();
      // PGRST116 = no rows → genuine 404; anything else is OUR failure, not a
      // deleted booklet — don't tell the parent the booklet is gone.
      if (getErr && getErr.code !== "PGRST116") return json({ error: "internal_error" }, 500);
      if (!booklet) return json({ error: "not_found" }, 404);

      // Title only — it's already printed on the sheet the scanner is holding.
      // goal/world can carry owner-typed notes that never appear on the page.
      return json({ title: booklet.title });
    }

    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400);

    const token = String(body.token ?? "");
    const filledBy = String(body.filled_by ?? "");
    const difficulty = body.difficulty == null ? null : String(body.difficulty);
    const mistakes = body.mistakes == null ? null : String(body.mistakes);
    const hardText = String(body.hard_text ?? "").trim().substring(0, 300) || null;

    if (!TOKEN_RE.test(token)) return json({ error: "invalid_token" }, 400);
    if (!FILLED_BY.includes(filledBy)) return json({ error: "invalid_filled_by" }, 400);
    if (difficulty !== null && !DIFFICULTY.includes(difficulty)) return json({ error: "invalid_difficulty" }, 400);
    if (mistakes !== null && !MISTAKES.includes(mistakes)) return json({ error: "invalid_mistakes" }, 400);
    // An empty report carries no signal — require at least one substantive field.
    if (difficulty === null && mistakes === null && !hardText) return json({ error: "empty_report" }, 400);

    const { data: booklet, error: lookupErr } = await admin
      .from("booklets")
      .select("id")
      .eq("share_token", token)
      .single();
    if (lookupErr && lookupErr.code !== "PGRST116") return json({ error: "internal_error" }, 500);
    if (!booklet) return json({ error: "not_found" }, 404);

    // Fast-path check; the AUTHORITATIVE cap is the DB trigger
    // enforce_booklet_result_caps (atomic — count-then-insert here races).
    const { count } = await admin
      .from("booklet_results")
      .select("*", { count: "exact", head: true })
      .eq("booklet_id", booklet.id);
    if ((count ?? 0) >= MAX_RESULTS_PER_BOOKLET) return json({ error: "too_many_results" }, 429);

    const { error: insertErr } = await admin.from("booklet_results").insert({
      booklet_id: booklet.id,
      filled_by: filledBy,
      difficulty,
      mistakes,
      hard_text: hardText,
    });
    if (insertErr) {
      if (/too_many_results|rate_limited/.test(insertErr.message ?? "")) {
        return json({ error: "too_many_results" }, 429);
      }
      console.error("record-booklet-result insert:", insertErr.message);
      return json({ error: "insert_failed" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("record-booklet-result error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
