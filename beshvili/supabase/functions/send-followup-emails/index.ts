import { createClient } from "jsr:@supabase/supabase-js@2";

// Triggered by GitHub Actions cron every 2 days — never by the client.
// Segments users and sends a single, relevant follow-up email per user per type.

const RESEND_API  = "https://api.resend.com/emails";
const SITE_URL    = "https://www.beshvili.com";
// Change FROM to "בשבילי <hi@beshvili.com>" after verifying beshvili.com in Resend dashboard.
const FROM        = "בשבילי <onboarding@resend.dev>";

type Segment = "on_limit" | "tried_failed" | "not_activated" | "created_one";

// ── Email templates ──────────────────────────────────────────────────────────

function tplOnLimit(name: string) {
  const hi = name ? `שלום ${name},` : "שלום,";
  return {
    subject: "יצרת 2 חוברות חינם — רוצה להמשיך? 🚀",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#20184A">
  <p style="font-size:22px;font-weight:800;margin-bottom:4px">בשבילי<span style="color:#F4A02C">·</span></p>
  <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px">
  <p style="font-size:16px">${hi}</p>
  <p>כבר יצרת <strong>2 חוברות בחינם</strong> עם בשבילי 🎉<br>
  כל חוברת חסכה לך ~45 דקות הכנה.</p>
  <p>רוצה להמשיך? שדרגי לפרו:</p>
  <table style="border-collapse:collapse;width:100%;margin:12px 0">
    <tr><td style="padding:10px 14px;background:#f7f6fb;border-radius:12px 12px 0 0;border:1px solid #ece9f6"><strong>🌟 הורה</strong> — 5 חוברות לחודש · ₪19</td></tr>
    <tr><td style="padding:10px 14px;background:#f0eeff;border-radius:0 0 12px 12px;border:1px solid #ddd8f9;border-top:none"><strong>🚀 מורה פרטית</strong> — 20 חוברות לחודש · ₪59</td></tr>
  </table>
  <a href="${SITE_URL}" style="display:inline-block;background:#6C5CE7;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;font-size:15px;margin:8px 0 20px">שדרגי עכשיו ←</a>
  <p style="color:#9c95c4;font-size:12px;margin-top:24px;border-top:1px solid #ece9f6;padding-top:12px">בשבילי · <a href="${SITE_URL}" style="color:#9c95c4">beshvili.com</a></p>
</div>`,
  };
}

function tplTriedFailed(name: string) {
  const hi = name ? `שלום ${name},` : "שלום,";
  return {
    subject: "הייתה תקלה קטנה — בואי ננסה שוב 🙏",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#20184A">
  <p style="font-size:22px;font-weight:800;margin-bottom:4px">בשבילי<span style="color:#F4A02C">·</span></p>
  <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px">
  <p style="font-size:16px">${hi}</p>
  <p>שמנו לב שהייתה תקלה קטנה בזמן שניסית ליצור חוברת.<br><strong>מצטערים!</strong></p>
  <p>התקלה תוקנה. ליצירת חוברת לוקח 60 שניות — בואי ננסה שוב:</p>
  <a href="${SITE_URL}" style="display:inline-block;background:#1FB58F;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;font-size:15px;margin:8px 0 20px">נסי שוב ←</a>
  <p style="color:#9c95c4;font-size:12px;margin-top:24px;border-top:1px solid #ece9f6;padding-top:12px">בשבילי · <a href="${SITE_URL}" style="color:#9c95c4">beshvili.com</a></p>
</div>`,
  };
}

function tplNotActivated(name: string) {
  const hi = name ? `שלום ${name},` : "שלום,";
  return {
    subject: "עדיין לא ניסית? 2 חוברות חינם מחכות לך 🎁",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#20184A">
  <p style="font-size:22px;font-weight:800;margin-bottom:4px">בשבילי<span style="color:#F4A02C">·</span></p>
  <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px">
  <p style="font-size:16px">${hi}</p>
  <p>נרשמת לבשבילי — <strong>עדיין לא יצרת חוברת</strong>?</p>
  <p>בשבילי יוצר חוברת עבודה שלמה בעברית, מותאמת לכיתה ולנושא, מוכנה להדפסה — תוך 60 שניות.</p>
  <ol style="line-height:2.2;margin:12px 0">
    <li>בוחרים כיתה ונושא</li>
    <li>לוחצים "צור חוברת"</li>
    <li>מקבלים A4 מוכן להדפסה</li>
  </ol>
  <a href="${SITE_URL}" style="display:inline-block;background:#F4A02C;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;font-size:15px;margin:8px 0 20px">צרי חוברת חינם ←</a>
  <p style="color:#9c95c4;font-size:12px;margin-top:24px;border-top:1px solid #ece9f6;padding-top:12px">
    בשבילי · <a href="${SITE_URL}" style="color:#9c95c4">beshvili.com</a><br>
    לביטול קבלת מיילים: השב "הסר" למייל זה
  </p>
</div>`,
  };
}

function tplCreatedOne(name: string) {
  const hi = name ? `שלום ${name},` : "שלום,";
  return {
    subject: "איך הייתה החוברת? נשארת לך עוד אחת חינם 🎁",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#20184A">
  <p style="font-size:22px;font-weight:800;margin-bottom:4px">בשבילי<span style="color:#F4A02C">·</span></p>
  <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px">
  <p style="font-size:16px">${hi}</p>
  <p>יצרת חוברת עם בשבילי — מקווים שהיא עזרה!</p>
  <p><strong>נשארת לך עוד חוברת אחת חינם.</strong><br>
  בואי תנצלי אותה לנושא אחר:</p>
  <a href="${SITE_URL}" style="display:inline-block;background:#6C5CE7;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;font-size:15px;margin:8px 0 20px">צרי עוד חוברת ←</a>
  <p style="color:#9c95c4;font-size:12px;margin-top:24px;border-top:1px solid #ece9f6;padding-top:12px">בשבילי · <a href="${SITE_URL}" style="color:#9c95c4">beshvili.com</a></p>
</div>`,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Only POST from GitHub Actions (with CRON_SECRET) or a manual trigger
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set — see setup instructions" }), { status: 500 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const sent: Record<Segment | "errors", number> = {
    on_limit: 0, tried_failed: 0, not_activated: 0, created_one: 0, errors: 0,
  };

  // Send one email — skip if this type was already sent to this user.
  async function deliver(userId: string, type: Segment, to: string, subject: string, html: string) {
    const { data: exists } = await admin
      .from("email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("email_type", type)
      .limit(1)
      .maybeSingle();
    if (exists) return; // already sent

    const r = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });

    if (!r.ok) {
      console.error(`[email] Resend ${r.status} for ${to}:`, await r.text());
      sent.errors++;
      return;
    }

    await admin.from("email_logs").insert({ user_id: userId, email_type: type });
    sent[type]++;
    console.log(`[email] sent ${type} → ${to}`);
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();

  // ── Segment 1: on_limit — free users who used both free booklets ──────────
  {
    const { data: rows } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("plan", "free")
      .gte("total_booklets_created", 2);

    for (const u of rows ?? []) {
      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email) continue;
      const { subject, html } = tplOnLimit(u.full_name ?? "");
      await deliver(u.id, "on_limit", email, subject, html);
    }
  }

  // ── Segment 2: tried_failed — booklet_error event, 0 saved booklets ───────
  {
    const { data: errEvts } = await admin
      .from("events")
      .select("user_id")
      .eq("type", "booklet_error")
      .gte("created_at", twoDaysAgo);

    const userIds = [...new Set((errEvts ?? []).map(e => e.user_id as string))];
    for (const uid of userIds) {
      const { data: p } = await admin.from("profiles").select("full_name, total_booklets_created").eq("id", uid).single();
      if ((p?.total_booklets_created ?? 0) > 0) continue; // they recovered

      const { data: au } = await admin.auth.admin.getUserById(uid);
      const email = au?.user?.email;
      if (!email) continue;
      const { subject, html } = tplTriedFailed(p?.full_name ?? "");
      await deliver(uid, "tried_failed", email, subject, html);
    }
  }

  // ── Segment 3: not_activated — registered 2+ days ago, never started ──────
  {
    const { data: rows } = await admin
      .from("profiles")
      .select("id, full_name")
      .lt("created_at", twoDaysAgo)
      .eq("total_booklets_created", 0);

    for (const u of rows ?? []) {
      const { data: ev } = await admin
        .from("events")
        .select("id")
        .eq("user_id", u.id)
        .eq("type", "booklet_started")
        .limit(1)
        .maybeSingle();
      if (ev) continue; // they at least tried

      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email) continue;
      const { subject, html } = tplNotActivated(u.full_name ?? "");
      await deliver(u.id, "not_activated", email, subject, html);
    }
  }

  // ── Segment 4: created_one — 1 booklet, 2+ days since last creation ───────
  {
    const { data: rows } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("plan", "free")
      .eq("total_booklets_created", 1);

    for (const u of rows ?? []) {
      const { data: last } = await admin
        .from("booklets")
        .select("created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || last.created_at > twoDaysAgo) continue; // too recent

      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email) continue;
      const { subject, html } = tplCreatedOne(u.full_name ?? "");
      await deliver(u.id, "created_one", email, subject, html);
    }
  }

  console.log("[send-followup-emails] done:", sent);
  return new Response(JSON.stringify(sent), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
