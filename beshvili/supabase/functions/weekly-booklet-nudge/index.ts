import { createClient } from "jsr:@supabase/supabase-js@2";

// weekly-booklet-nudge — the habit engine. Every Sunday morning (first school
// day) each activated-but-inactive user gets a personalized "החוברת השבועית"
// email: child's name, last topic, difficulty-aware suggestion, and a deep
// link that pre-fills the create form (Dashboard parses ?wk=1&... into
// pendingStarter). Conversion diagnosis behind it: 67/170 users created a
// booklet, only 15 came back for a second — the product lacked a reason to
// return. This is the reason.
//
// Triggered ONLY by GitHub Actions cron (weekly-booklet-nudge.yml).

const RESEND_API = "https://api.resend.com/emails";
const SITE_URL   = "https://www.beshvili.com";
const FROM       = "בשבילי <hello@beshvili.com>";
const SUPABASE_URL = "https://gywpdzkvkdisonuzhsib.supabase.co";

const EMAIL_TYPE   = "weekly_nudge";
const RESEND_DAYS  = 6;   // one nudge per user per week
const ACTIVE_DAYS  = 5;   // created a booklet in the last 5 days → no nudge needed
const MAX_SENDS    = 300; // hard cap per run — a bug can never mail-bomb the base

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildEmail(opts: {
  firstName: string;
  childName: string;
  lastGoal: string;
  suggestion: string;
  deepLink: string;
  quotaLine: string;       // quota-aware CTA context line (may be "")
  ctaLabel: string;
  unsubToken: string | null;
}) {
  const hi = opts.firstName ? `שלום ${esc(opts.firstName)},` : "שלום,";
  const childBit = opts.childName ? ` של ${esc(opts.childName)}` : "";
  const unsubLink = opts.unsubToken
    ? `<a href="${SUPABASE_URL}/functions/v1/unsubscribe?token=${opts.unsubToken}" style="color:#aaa;">הסרה מרשימת תפוצה</a>`
    : "";
  return {
    subject: opts.childName
      ? `החוברת השבועית של ${opts.childName} מחכה ליצירה 📚`
      : "החוברת השבועית שלכם מחכה ליצירה 📚",
    html: `<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;padding:28px;border:1px solid #eee;">
    <p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#20184A;">בשבילי<span style="color:#F4A02C;">·</span></p>
    <hr style="border:none;border-top:1px solid #ece9f6;margin:12px 0 20px;">
    <p style="font-size:16px;color:#20184A;">${hi}</p>
    <p style="font-size:15px;color:#333;line-height:1.7;">שבוע לימודים חדש מתחיל — זה הזמן לחוברת השבועית${childBit} 🎯</p>
    ${opts.lastGoal ? `<div style="background:#f7f6fb;border-radius:12px;padding:12px 16px;margin:14px 0;">
      <p style="font-size:13px;color:#9c95c4;margin:0 0 4px;">בפעם הקודמת תרגלתם:</p>
      <p style="font-size:14px;font-weight:700;color:#20184A;margin:0;">${esc(opts.lastGoal)}</p>
      <p style="font-size:13px;color:#555;margin:6px 0 0;">${esc(opts.suggestion)}</p>
    </div>` : ""}
    <div style="text-align:center;margin:22px 0 8px;">
      <a href="${opts.deepLink}" style="display:inline-block;background:#6C5CE7;color:white;padding:13px 30px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;">${esc(opts.ctaLabel)}</a>
    </div>
    ${opts.quotaLine ? `<p style="font-size:12px;color:#888;text-align:center;margin:8px 0 0;">${opts.quotaLine}</p>` : ""}
    <p style="font-size:12px;color:#9c95c4;margin:20px 0 0;border-top:1px solid #ece9f6;padding-top:12px;">
      הקישור פותח את הטופס כשהוא כבר מלא — נשאר רק ללחוץ "צור" · בשבילי · <a href="${SITE_URL}" style="color:#9c95c4;">beshvili.com</a>${unsubLink ? ` · ${unsubLink}` : ""}
    </p>
  </div></body></html>`,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  // Fail CLOSED: deployed with --no-verify-jwt and can mass-email every user.
  // If CRON_SECRET is unset, refuse — don't skip the check.
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

  const now = Date.now();
  const activeCutoff = new Date(now - ACTIVE_DAYS * 86_400_000).toISOString();
  const resendCutoff = new Date(now - RESEND_DAYS * 86_400_000).toISOString();

  const stats = { sent: 0, skipped_active: 0, skipped_recent_nudge: 0, skipped_no_email: 0, skipped_quota_dead_end: 0, errors: 0 };

  // Audience: activated (>=1 booklet ever), not admin, not unsubscribed.
  const { data: candidates, error: candErr } = await admin
    .from("profiles")
    .select("id, plan, full_name, total_booklets_created, booklet_credits_granted, unsubscribed_at, unsubscribe_token")
    .gte("total_booklets_created", 1)
    .neq("plan", "admin")
    .is("unsubscribed_at", null)
    .limit(1000);
  if (candErr) {
    console.error("[weekly-nudge] candidates query:", candErr.message);
    return new Response(JSON.stringify({ error: "query_failed" }), { status: 500 });
  }

  for (const p of candidates ?? []) {
    if (stats.sent >= MAX_SENDS) break;

    // Weekly dedupe (time-windowed — unlike the one-shot followup types).
    const { data: recentLog } = await admin
      .from("email_logs")
      .select("id")
      .eq("user_id", p.id)
      .eq("email_type", EMAIL_TYPE)
      .gte("sent_at", resendCutoff)
      .limit(1)
      .maybeSingle();
    if (recentLog) { stats.skipped_recent_nudge++; continue; }

    // Last booklet — personalization source + activity check.
    const { data: lastBooklet } = await admin
      .from("booklets")
      .select("created_at, goal, world, child_name, grade, level, difficulty_feedback")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastBooklet?.created_at && lastBooklet.created_at >= activeCutoff) {
      stats.skipped_active++;
      continue; // created a booklet this week — the habit is alive, don't nag
    }

    // Quota awareness: free users with a fully exhausted allowance get the
    // pack/upgrade framing instead of a "create now" CTA that dead-ends.
    const isPaid = p.plan === "teacher" || p.plan === "parent" || p.plan === "pro";
    const allowance = 2 + (p.booklet_credits_granted ?? 0);
    const freeLeft = Math.max(0, allowance - (p.total_booklets_created ?? 0));
    if (!isPaid && freeLeft === 0) {
      // Exhausted free users already get the on_limit/pack emails — a weekly
      // "create!" nudge that hits a paywall would just burn goodwill.
      stats.skipped_quota_dead_end++;
      continue;
    }

    // Child profile (preferred over last booklet's child_name).
    const { data: child } = await admin
      .from("children")
      .select("name, grade, level")
      .eq("user_id", p.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const childName = child?.name ?? lastBooklet?.child_name ?? "";
    const grade     = child?.grade ?? lastBooklet?.grade ?? "";
    const level     = lastBooklet?.level ?? child?.level ?? "medium";
    const lastGoal  = lastBooklet?.goal ?? lastBooklet?.world ?? "";

    // Difficulty-aware suggestion (from the printed-QR feedback loop).
    const fb = lastBooklet?.difficulty_feedback;
    const suggestion =
      fb === "too_hard" ? "השבוע כדאי חוברת חיזוק על אותו נושא — ברמה נגישה יותר, עם יותר הדרכה." :
      fb === "too_easy" ? "הפעם אפשר להעלות רמה — אתגר אמיתי על אותו נושא." :
      "השבוע ממשיכים לחזק — חזרה קצרה ואז צעד אחד קדימה.";

    // Deep link → Dashboard parses into pendingStarter (pre-filled form).
    const params = new URLSearchParams({ wk: "1" });
    if (childName) params.set("child", childName);
    if (grade)     params.set("grade", grade);
    if (lastGoal)  params.set("goal", lastGoal);
    if (level)     params.set("level", level);
    if (fb === "too_hard" && lastGoal) params.set("weak", lastGoal);
    const deepLink = `${SITE_URL}/?${params.toString()}`;

    const quotaLine = isPaid ? "" : `נותרו לך ${freeLeft} חוברות — המכסה מתאפסת רק כשמשדרגים 😉`;

    const { data: au } = await admin.auth.admin.getUserById(p.id);
    const email = au?.user?.email;
    if (!email) { stats.skipped_no_email++; continue; }

    const firstName = (p.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    const { subject, html } = buildEmail({
      firstName,
      childName,
      lastGoal,
      suggestion,
      deepLink,
      quotaLine,
      ctaLabel: childName ? `ליצירת החוברת של ${childName} ←` : "ליצירת החוברת השבועית ←",
      unsubToken: p.unsubscribe_token ?? null,
    });

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    };
    const emailBody: Record<string, unknown> = { from: FROM, to: [email], subject, html, reply_to: "naorez92@gmail.com" };
    if (p.unsubscribe_token) {
      emailBody.headers = {
        "List-Unsubscribe": `<${SUPABASE_URL}/functions/v1/unsubscribe?token=${p.unsubscribe_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };
    }

    const r = await fetch(RESEND_API, { method: "POST", headers, body: JSON.stringify(emailBody) });
    if (!r.ok) {
      console.error(`[weekly-nudge] Resend ${r.status} for user ${p.id}:`, (await r.text()).slice(0, 200));
      stats.errors++;
      continue;
    }

    await admin.from("email_logs").insert({ user_id: p.id, email_type: EMAIL_TYPE });
    admin.from("events").insert({ user_id: p.id, event: "weekly_nudge_sent", metadata: { hasChild: !!childName, fb: fb ?? null } })
      .then(() => {}, () => {});
    stats.sent++;
    console.log(`[weekly-nudge] sent → user ${p.id}`); // user id only — no email PII in logs
  }

  console.log("[weekly-nudge] done:", JSON.stringify(stats));
  return new Response(JSON.stringify({ ok: true, ...stats }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
