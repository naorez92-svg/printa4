import { createClient } from "jsr:@supabase/supabase-js@2";

// Called daily by GitHub Actions cron — sends renewal reminder to pro users at D+25
// Also callable manually by admin from AdminPanel

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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: cors });
  }

  // Authorize: service role key (cron) or admin JWT
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (token !== serviceRoleKey) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "admin") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }

  const now = new Date();
  // pro_since between 25 and 32 days ago (wide window so a missed day doesn't skip a user)
  const d25 = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
  const d32 = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch profiles in the D+25–D+32 window, including renewal_reminder_sent_at so we
  // can detect subscription renewal: if admin resets pro_since for a renewed subscriber,
  // renewal_reminder_sent_at < pro_since → send a fresh reminder for the new cycle.
  const { data: rawProfiles } = await admin
    .from("profiles")
    .select("id, pro_since, plan, renewal_reminder_sent_at")
    .in("plan", ["pro", "parent", "teacher"])
    .lte("pro_since", d25)
    .gte("pro_since", d32);

  const pendingProfiles = (rawProfiles ?? []).filter(p =>
    p.renewal_reminder_sent_at === null ||
    (p.pro_since !== null && p.renewal_reminder_sent_at < p.pro_since)
  );

  if (!pendingProfiles?.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No pro users due for renewal reminder" }), { status: 200, headers: cors });
  }

  const userIds = pendingProfiles.map(p => p.id);
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId: Record<string, string> = {};
  (authData?.users ?? []).forEach(u => { if (u.email) emailByUserId[u.id] = u.email; });

  // Unsubscribe state (migration 0028) — separate, graceful query.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const unsubByUser: Record<string, { off: boolean; token: string | null }> = {};
  {
    const { data: uData, error: uErr } = await admin
      .from("profiles").select("id, unsubscribed_at, unsubscribe_token").in("id", userIds);
    if (!uErr && uData) uData.forEach((p: { id: string; unsubscribed_at: string | null; unsubscribe_token: string | null }) => {
      unsubByUser[p.id] = { off: !!p.unsubscribed_at, token: p.unsubscribe_token };
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const profile of pendingProfiles) {
    const email = emailByUserId[profile.id];
    if (!email) continue;
    if (unsubByUser[profile.id]?.off) continue; // respect opt-out
    const unsubTok  = unsubByUser[profile.id]?.token;
    const unsubLink = unsubTok ? ` · <a href="${SUPABASE_URL}/functions/v1/unsubscribe?token=${unsubTok}" style="color:#aaa;">הסרה מרשימת תפוצה</a>` : "";

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #eee;">
    <div style="font-size:32px;text-align:center;margin-bottom:16px;">🚀</div>
    <h2 style="color:#20184A;text-align:center;margin:0 0 16px;">חידוש המנוי — 5 ימים נשארו</h2>
    <p style="color:#555;line-height:1.7;margin:0 0 16px;">
      שלום!<br><br>
      המנוי שלך לבשבילי מסתיים בעוד ~5 ימים.<br>
      כדי להמשיך ליצור חוברות, שלחי ${profile.plan === "parent" ? "19" : profile.plan === "teacher" ? "59" : "30"} ₪ בביט למספר <strong>050-913-9137</strong> ואז וואטסאפ לאישור.
    </p>
    <div style="background:#F7F6FB;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-weight:bold;color:#20184A;font-size:14px;">התוכנית שלך — ${profile.plan === "parent" ? "הורה 🌟" : profile.plan === "teacher" ? "מורה 🚀" : "פרו 🚀"}:</p>
      <ul style="margin:0;padding-right:20px;color:#555;font-size:14px;line-height:2;">
        ${profile.plan === "parent" ? "<li>5 חוברות לחודש</li><li>עד 10 עמודים לחוברת</li>" : "<li>20 חוברות לחודש</li><li>עד 20 עמודים לחוברת</li>"}
        <li>מפתח תשובות אוטומטי</li>
        <li>שמירה בענן לצמיתות</li>
      </ul>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://wa.me/972509139137?text=${encodeURIComponent(`שלום! אני רוצה לחדש את המנוי שלי בבשבילי 🚀 שלחתי ${profile.plan === "parent" ? "19" : profile.plan === "teacher" ? "59" : "30"} ₪ בביט`)}"
         style="display:inline-block;background:linear-gradient(to left,#F4A02C,#6C5CE7);color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;">
        💙 חדשי עכשיו
      </a>
    </div>
    <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
      בשבילי · <a href="mailto:naorez92@gmail.com" style="color:#aaa;">צרי קשר</a>${unsubLink}
    </p>
  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "בשבילי <hello@beshvili.com>",
        to: [email],
        subject: "חידוש המנוי שלך — 5 ימים נשארו 🚀",
        html,
        ...(unsubTok ? { headers: { "List-Unsubscribe": `<${SUPABASE_URL}/functions/v1/unsubscribe?token=${unsubTok}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
    });

    if (resendRes.ok) {
      await admin.from("profiles").update({ renewal_reminder_sent_at: now.toISOString() }).eq("id", profile.id);
      sent++;
    } else {
      const txt = await resendRes.text();
      errors.push(`${email}: ${txt}`);
    }
  }

  return new Response(JSON.stringify({ sent, total: pendingProfiles.length, errors }), { status: 200, headers: cors });
});
