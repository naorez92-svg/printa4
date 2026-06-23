import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

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

  const { data: booklet, error } = await admin
    .from("booklets")
    .select("title, html, created_at")
    .eq("share_token", token)
    .single();

  if (error || !booklet) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
  }

  return new Response(
    JSON.stringify({ title: booklet.title, html: booklet.html, createdAt: booklet.created_at }),
    { headers: { ...cors, "content-type": "application/json" } }
  );
});
