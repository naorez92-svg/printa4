import { createClient } from "jsr:@supabase/supabase-js@2";

// Triggered by GitHub Actions cron every 2 days — never by the client.
// Segments users and sends a single, relevant follow-up email per user per type.

const RESEND_API  = "https://api.resend.com/emails";
const SITE_URL    = "https://www.beshvili.com";
const SUPABASE_FN = "https://gywpdzkvkdisonuzhsib.supabase.co/functions/v1";
const SURVEY_FN   = `${SUPABASE_FN}/record-survey-answer`;
const FROM        = "בשבילי <hello@beshvili.com>";

type Segment = "on_limit" | "tried_failed" | "not_activated" | "created_one";

// One-click survey URL — clicking registers the answer and redirects to beshvili.com.
// Uses the per-user unsubscribe_token (unguessable) rather than the raw uid, so a
// third party who learns a user's UUID can't forge survey answers for them.
const su = (token: string, q: string, a: string, ctx: string) =>
  `${SURVEY_FN}?t=${token}&q=${q}&a=${a}&ctx=${ctx}`;

// Inline survey block for email — 3 button links, one-click, no form
function surveyBlock(token: string, question: string, options: {label: string; value: string}[], q: string, ctx: string) {
  const buttons = options.map(o =>
    `<a href="${su(token, q, o.value, ctx)}" style="display:inline-block;background:#6C5CE7;color:#fff;text-decoration:none;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;margin:3px">${o.label}</a>`
  ).join("");
  return `<div style="margin:20px 0;padding:14px 16px;background:#f7f6fb;border-radius:14px;text-align:center">
  <p style="font-size:12px;color:#9c95c4;margin:0 0 6px">שאלה אחת (לחיצה אחת) 🙏</p>
  <p style="font-weight:700;font-size:14px;color:#20184A;margin:0 0 12px">${question}</p>
  <div>${buttons}</div>
</div>`;
}

// ── Email templates ──────────────────────────────────────────────────────────

// Shared footer — every marketing email must carry a working unsubscribe link.
const footer = (token: string) =>
  `<p style="color:#9c95c4;font-size:12px;margin-top:24px;border-top:1px solid #ece9f6;padding-top:12px">בשבילי · <a href="${SITE_URL}" style="color:#9c95c4">beshvili.com</a> · <a href="${SUPABASE_FN}/unsubscribe?token=${token}" style="color:#9c95c4">הסרה מרשימת תפוצה</a></p>`;

function tplOnLimit(name: string, token: string) {
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
  ${surveyBlock(token, "כמה חוברות לחודש את צריכה?", [
    { label: "עד 5", value: "up_to_5" },
    { label: "5–15", value: "five_to_15" },
    { label: "20+",  value: "twenty_plus" },
  ], "monthly_need", "email_on_limit")}
  ${footer(token)}
</div>`,
  };
}

function tplTriedFailed(name: string, token: string) {
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
  ${footer(token)}
</div>`,
  };
}

function tplNotActivated(name: string, token: string) {
  const hi = name ? `שלום ${name},` : "שלום,";
  return {
    subject: "עדיין לא ניסית? 2 חוברות חינם מחכות לך 🎁",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#20184A">
  <p style="font-size:22px;font-weight:800;margin-bottom:4px">בשבילי<span style="color:#F4A02C">·</span></p>
  <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px">
  <p style="font-size:16px">${hi}</p>
  <p>נרשמת לבשבילי — <strong>עדיין לא יצרת חוברת</strong>?</p>
  <p>בשבילי יוצר חוברת עבודה שלמה בעברית, מותאמת לכיתה ולנושא, מוכנת להדפסה — תוך 60 שניות.</p>
  <ol style="line-height:2.2;margin:12px 0">
    <li>בוחרים כיתה ונושא</li>
    <li>לוחצים “צור חוברת”</li>
    <li>מקבלים A4 מוכן להדפסה</li>
  </ol>
  <a href="${SITE_URL}" style="display:inline-block;background:#F4A02C;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:bold;font-size:15px;margin:8px 0 20px">צרי חוברת חינם ←</a>
  ${surveyBlock(token, "מה עצר אותך עד עכשיו?", [
    { label: "לא היה לי זמן",          value: "no_time" },
    { label: "לא הבנתי מה לעשות",      value: "didnt_understand" },
    { label: "לא היה לי נושא מתאים",   value: "no_topic" },
  ], "barrier", "email_not_activated")}
  ${footer(token)}
</div>`,
  };
}

function tplCreatedOne(name: string, token: string) {
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
  ${surveyBlock(token, "לאיזה מצב הכי משתמשת בחוברות?", [
    { label: "שיעורים פרטיים", value: "private_lessons" },
    { label: "כיתה שלמה",      value: "full_class" },
    { label: "שיעורי בית",     value: "homework" },
  ], "use_case", "email_created_one")}
  ${footer(token)}
</div>`,
  };
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  // Fail CLOSED: this endpoint is deployed with --no-verify-jwt and can mass-email
  // every user. If CRON_SECRET is unset/renamed, refuse — don't skip the check.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const sent: Record<Segment | "errors" | "skipped_dedupe_error", number> = {
    on_limit: 0, tried_failed: 0, not_activated: 0, created_one: 0, errors: 0, skipped_dedupe_error: 0,
  };
  // Segment-level query failures — surfaced in the response + a non-200 status so
  // the GitHub Actions cron run fails visibly instead of reporting green on a
  // broken query (that's exactly how the `type`-vs-`event` column bug hid).
  const queryErrors: string[] = [];

  async function deliver(userId: string, type: Segment, to: string, subject: string, html: string, unsubToken: string | null) {
    // Dedupe check must FAIL CLOSED: if the read errors we can't prove this email
    // wasn't already sent, and re-sending on every 2-day cron is worse than
    // skipping one run.
    const { data: exists, error: dedupeErr } = await admin
      .from("email_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("email_type", type)
      .limit(1)
      .maybeSingle();
    if (dedupeErr) {
      console.error(`[email] dedupe check failed for ${userId}/${type}:`, dedupeErr.message);
      sent.skipped_dedupe_error++;
      return;
    }
    if (exists) return;

    const r = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to, subject, html,
        ...(unsubToken ? {
          headers: {
            "List-Unsubscribe": `<${SUPABASE_FN}/unsubscribe?token=${unsubToken}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        } : {}),
      }),
    });

    if (!r.ok) {
      console.error(`[email] Resend ${r.status} for ${to}:`, await r.text());
      sent.errors++;
      return;
    }

    const { error: logErr } = await admin.from("email_logs").insert({ user_id: userId, email_type: type });
    // A failed log write means this user WILL be re-emailed next run — loud log so
    // it's visible in the function logs before that happens.
    if (logErr) console.error(`[email] email_logs insert failed for ${userId}/${type}:`, logErr.message);
    sent[type]++;
    console.log(`[email] sent ${type} → ${to}`);
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const PROFILE_COLS = "id, full_name, unsubscribed_at, unsubscribe_token";

  // ── Segment 1: on_limit ──────────────────────────────────────
  {
    const { data: rows, error } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("plan", "free")
      .is("unsubscribed_at", null)
      .gte("total_booklets_created", 2);
    if (error) queryErrors.push(`on_limit: ${error.message}`);

    for (const u of rows ?? []) {
      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email || !u.unsubscribe_token) continue;
      const { subject, html } = tplOnLimit(u.full_name ?? "", u.unsubscribe_token);
      await deliver(u.id, "on_limit", email, subject, html, u.unsubscribe_token);
    }
  }

  // ── Segment 2: tried_failed ─────────────────────────────────
  {
    const { data: errEvts, error } = await admin
      .from("events")
      .select("user_id")
      .eq("event", "booklet_error")
      .gte("created_at", twoDaysAgo);
    if (error) queryErrors.push(`tried_failed: ${error.message}`);

    const userIds = [...new Set((errEvts ?? []).map(e => e.user_id as string))].filter(Boolean);
    for (const uid of userIds) {
      const { data: p } = await admin.from("profiles")
        .select("full_name, total_booklets_created, unsubscribed_at, unsubscribe_token")
        .eq("id", uid).maybeSingle();
      if (!p || p.unsubscribed_at || !p.unsubscribe_token) continue;
      if ((p.total_booklets_created ?? 0) > 0) continue;

      const { data: au } = await admin.auth.admin.getUserById(uid);
      const email = au?.user?.email;
      if (!email) continue;
      const { subject, html } = tplTriedFailed(p.full_name ?? "", p.unsubscribe_token);
      await deliver(uid, "tried_failed", email, subject, html, p.unsubscribe_token);
    }
  }

  // ── Segment 3: not_activated ────────────────────────────────
  {
    const { data: rows, error } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .lt("created_at", twoDaysAgo)
      .is("unsubscribed_at", null)
      .eq("total_booklets_created", 0);
    if (error) queryErrors.push(`not_activated: ${error.message}`);

    for (const u of rows ?? []) {
      const { data: ev, error: evErr } = await admin
        .from("events")
        .select("id")
        .eq("user_id", u.id)
        .eq("event", "booklet_started")
        .limit(1)
        .maybeSingle();
      // Fail closed: if we can't tell whether the user already tried, don't send
      // them a "you never tried?" email that may be wrong and off-putting.
      if (evErr || ev) continue;

      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email || !u.unsubscribe_token) continue;
      const { subject, html } = tplNotActivated(u.full_name ?? "", u.unsubscribe_token);
      await deliver(u.id, "not_activated", email, subject, html, u.unsubscribe_token);
    }
  }

  // ── Segment 4: created_one ─────────────────────────────────
  {
    const { data: rows, error } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("plan", "free")
      .is("unsubscribed_at", null)
      .eq("total_booklets_created", 1);
    if (error) queryErrors.push(`created_one: ${error.message}`);

    for (const u of rows ?? []) {
      const { data: last } = await admin
        .from("booklets")
        .select("created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || last.created_at > twoDaysAgo) continue;

      const { data: au } = await admin.auth.admin.getUserById(u.id);
      const email = au?.user?.email;
      if (!email || !u.unsubscribe_token) continue;
      const { subject, html } = tplCreatedOne(u.full_name ?? "", u.unsubscribe_token);
      await deliver(u.id, "created_one", email, subject, html, u.unsubscribe_token);
    }
  }

  console.log("[send-followup-emails] done:", sent, queryErrors.length ? { queryErrors } : "");
  return new Response(JSON.stringify({ ...sent, queryErrors }), {
    // Non-200 when a segment query failed so the cron run shows red.
    status: queryErrors.length ? 500 : 200,
    headers: { "content-type": "application/json" },
  });
});
