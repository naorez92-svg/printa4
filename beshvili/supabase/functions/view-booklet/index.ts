import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Public endpoint — serves a booklet by its share_token (no auth required)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 400, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Only booklets the owner has explicitly shared (is_public) are served — a
  // freshly-created booklet is private until the user shares it.
  // goal/grade/world/level power the share page's "create one like this" CTA —
  // deliberately NOT child_name (privacy: the recipient gets the recipe, not the child).
  const { data: booklet, error } = await admin
    .from("booklets")
    .select("title, html, created_at, goal, grade, world, level")
    .eq("share_token", token)
    .eq("is_public", true)
    .single();

  if (error || !booklet) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
  }

  return new Response(
    JSON.stringify({
      title: booklet.title, html: booklet.html, createdAt: booklet.created_at,
      goal: booklet.goal, grade: booklet.grade, world: booklet.world, level: booklet.level,
    }),
    { headers: { ...cors, "content-type": "application/json" } }
  );
});
