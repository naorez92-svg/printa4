import { createClient } from "jsr:@supabase/supabase-js@2";

// notify-lead — fires when a user shows purchase intent (opens pay flow in UpgradeModal).
// Does TWO things the old client-side insert never did:
//   1. Inserts the lead server-side (service role) so RLS can never silently drop it.
//   2. Emails the owner immediately so a hot lead never sits unseen in the DB.
// The client calls this fire-and-forget — it never blocks the WhatsApp/Bit redirect.

const OWNER_EMAIL = "naorez92@gmail.com";

const PLAN_LABELS: Record<string, string> = {
  parent:  "הורה (₪19/חודש)",
  teacher: "מורה פרטית (₪59/חודש)",
  pro:     "פרו",
};

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
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Verify the caller — purchase intent always comes from a logged-in user.
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const body = await req.json().catch(() => ({}));
    const clean = (v: unknown, max = 200) => String(v ?? "").replace(/[\r\n\t]/g, " ").trim().substring(0, max);
    // Escape HTML so user-controlled fields can't inject markup into the owner's inbox.
    const esc = (v: unknown) => String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const name    = clean(body.name, 100);
    const phone   = clean(body.phone, 40) || null;
    const planId  = ["parent", "teacher", "pro"].includes(body.plan) ? body.plan : "teacher";
    const method  = body.method === "bit" ? "bit" : body.method === "whatsapp" ? "whatsapp" : "unknown";
    const bookletCount = Number.isInteger(body.bookletCount) ? body.bookletCount : 0;

    // Pull the user's plan so the email shows free vs already-paid.
    const { data: profile } = await admin
      .from("profiles").select("plan, full_name").eq("id", user.id).single();
    const currentPlan = profile?.plan ?? "free";
    const displayName = name || clean(profile?.full_name, 100) || "—";
    const userEmail   = user.email ?? "—";

    // Anti-spam: skip the owner email if this user already produced a lead in the
    // last 5 minutes (rapid double-clicks / scripted abuse). The lead is still saved.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentLeadCount } = await admin
      .from("leads").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", fiveMinAgo);

    // 1. Persist the lead server-side (immune to client RLS silent-failure).
    //    supabase-js returns { error } instead of throwing, so check it explicitly.
    const { error: insertErr } = await admin.from("leads").insert({
      user_id: user.id,
      name:    name || null,
      phone,
    });
    if (insertErr) console.error("notify-lead insert error:", insertErr.message);

    // 2. Email the owner immediately (unless rate-limited).
    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailed = false;
    if (resendKey && (recentLeadCount ?? 0) === 0) {
      const planLabel   = PLAN_LABELS[planId] ?? planId;
      const methodLabel = method === "bit" ? "ביט 💙" : method === "whatsapp" ? "וואטסאפ 💬" : method;
      const html = `<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:28px;border:1px solid #eee;">
    <div style="font-size:30px;text-align:center;margin-bottom:8px;">🔥</div>
    <h2 style="color:#20184A;text-align:center;margin:0 0 20px;">ליד חם — מישהו רוצה לשדרג!</h2>
    <table style="width:100%;border-collapse:collapse;font-size:15px;color:#333;">
      <tr><td style="padding:8px 0;color:#888;width:120px;">שם</td><td style="padding:8px 0;font-weight:bold;">${esc(displayName)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">אימייל</td><td style="padding:8px 0;"><a href="mailto:${esc(userEmail)}" style="color:#6C5CE7;">${esc(userEmail)}</a></td></tr>
      ${phone ? `<tr><td style="padding:8px 0;color:#888;">טלפון</td><td style="padding:8px 0;font-weight:bold;">${esc(phone)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#888;">תוכנית מבוקשת</td><td style="padding:8px 0;font-weight:bold;color:#6C5CE7;">${esc(planLabel)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">אמצעי תשלום</td><td style="padding:8px 0;">${esc(methodLabel)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">תוכנית נוכחית</td><td style="padding:8px 0;">${esc(currentPlan)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">חוברות שיצר/ה</td><td style="padding:8px 0;">${bookletCount}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="https://wa.me/972509139137" style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:bold;">פתח וואטסאפ</a>
    </div>
    <p style="color:#aaa;font-size:11px;text-align:center;margin:16px 0 0;">בשבילי · התראת ליד אוטומטית</p>
  </div></body></html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "בשבילי <hello@beshvili.com>",
          to: [OWNER_EMAIL],
          reply_to: userEmail !== "—" ? userEmail : undefined,
          subject: `🔥 ליד חם: ${displayName} רוצה ${planLabel}`,
          html,
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("notify-lead resend error:", await res.text());
    }

    // 3. Instant WhatsApp ping to the owner (optional — only if configured via
    //    CallMeBot: set secrets OWNER_WHATSAPP_PHONE + CALLMEBOT_APIKEY). This is
    //    the fastest channel: a hot lead reaches the phone in seconds.
    let whatsapped = false;
    if ((recentLeadCount ?? 0) === 0) {
      const waPhone = Deno.env.get("OWNER_WHATSAPP_PHONE");   // e.g. 972509139137
      const waKey   = Deno.env.get("CALLMEBOT_APIKEY");
      if (waPhone && waKey) {
        try {
          const planLabel = PLAN_LABELS[planId] ?? planId;
          const lines = [
            "🔥 ליד חם בבשבילי!",
            `שם: ${displayName}`,
            `תוכנית: ${planLabel}`,
            userEmail !== "—" ? `מייל: ${userEmail}` : "",
            phone ? `טלפון: ${phone}` : "",
          ].filter(Boolean).join("\n");
          const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waPhone)}&text=${encodeURIComponent(lines)}&apikey=${encodeURIComponent(waKey)}`;
          const waRes = await fetch(waUrl, { signal: AbortSignal.timeout(10_000) });
          whatsapped = waRes.ok;
          if (!waRes.ok) console.error("notify-lead whatsapp error:", waRes.status);
        } catch (e) {
          console.error("notify-lead whatsapp failed:", e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, emailed, whatsapped }), { status: 200, headers: cors });
  } catch (e) {
    console.error("notify-lead error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: cors });
  }
});
