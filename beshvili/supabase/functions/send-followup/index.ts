import { createClient } from "jsr:@supabase/supabase-js@2";

// Called daily by GitHub Actions cron (9:00am Israel) with service role key
// OR manually from admin panel

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

const FREE_LIMIT = 3; // must match useProfile.js + DB trigger

// HTML-escape user-controlled values (full_name) before interpolation.
const esc = (s: string) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buildEmailHtml(greeting: string, bodyHtml: string, ctaText: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #eee;">
    <div style="font-size:32px;text-align:center;margin-bottom:16px;">📚</div>
    <h2 style="color:#20184A;text-align:center;margin:0 0 16px;">${greeting}</h2>
    ${bodyHtml}
    <div style="text-align:center;margin:24px 0;">
      <a href="${ctaUrl}"
         style="display:inline-block;background:linear-gradient(to left,#F4A02C,#6C5CE7);color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;">
        ${ctaText}
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
      בשבילי · <a href="mailto:naorez92@gmail.com" style="color:#aaa;">צרי קשר</a>
    </p>
  </div>
</body>
</html>`;
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

  // Authorize: service role key (cron) or admin JWT — BEFORE reading body
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token !== serviceRoleKey) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "admin") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }

  // Parse body after auth is confirmed
  let body: { sameDay?: boolean; emergency?: boolean } = {};
  try { body = await req.json(); } catch { /* no body or not JSON */ }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() -  2 * 60 * 60 * 1000).toISOString();
  const oneDayAgo   = new Date(now.getTime() -  1 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo  = new Date(now.getTime() -  2 * 24 * 60 * 60 * 1000).toISOString();
  const fourDaysAgo = new Date(now.getTime() -  4 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(now.getTime() -  5 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo  = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

  // Load all profiles (free + pro, non-admin) — without dormant_followup_sent_at
  // so this query works even if migration 0020 hasn't been applied yet.
  const { data: allProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name, plan, followup_sent_at, created_at");

  if (profilesError) {
    console.error("[send-followup] profiles query failed:", profilesError.message);
    return new Response(JSON.stringify({
      error: "profiles_query_failed",
      detail: profilesError.message,
    }), { status: 500, headers: cors });
  }

  const profileMap: Record<string, {
    full_name: string | null;
    plan: string;
    followup_sent_at: string | null;
    created_at: string;
  }> = {};
  (allProfiles ?? []).forEach(p => { profileMap[p.id] = p; });

  const allIds = Object.keys(profileMap);

  // Separately fetch dormant_followup_sent_at (added by migration 0020).
  // If column doesn't exist yet, this query fails silently — Wave 2 is skipped.
  let dormantByUser: Record<string, string | null> | null = null;
  if (allIds.length > 0) {
    const { data: dData, error: dErr } = await admin
      .from("profiles")
      .select("id, dormant_followup_sent_at")
      .in("id", allIds);
    if (!dErr && dData) {
      dormantByUser = {};
      dData.forEach((p: { id: string; dormant_followup_sent_at: string | null }) => {
        dormantByUser![p.id] = p.dormant_followup_sent_at;
      });
    }
  }

  // Booklets: count + last created_at per user
  const { data: allBooklets } = await admin.from("booklets").select("user_id, created_at").in("user_id", allIds);
  const bookletsByUser: Record<string, number> = {};
  const lastBookletByUser: Record<string, string> = {};
  (allBooklets ?? []).forEach((b: { user_id: string; created_at: string }) => {
    bookletsByUser[b.user_id] = (bookletsByUser[b.user_id] ?? 0) + 1;
    if (!lastBookletByUser[b.user_id] || b.created_at > lastBookletByUser[b.user_id]) {
      lastBookletByUser[b.user_id] = b.created_at;
    }
  });

  // Auth emails
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById: Record<string, string> = {};
  (authData?.users ?? []).forEach(u => { if (u.email) emailById[u.id] = u.email; });

  let sent = 0;
  const errors: string[] = [];

  async function sendEmail(userId: string, subject: string, html: string, markField: string) {
    const email = emailById[userId];
    if (!email) return;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "בשבילי <hello@beshvili.com>", to: [email], subject, html }),
    });
    if (res.ok) {
      await admin.from("profiles").update({ [markField]: now.toISOString() }).eq("id", userId);
      sent++;
    } else {
      errors.push(`${email}: ${await res.text()}`);
    }
  }

  // ── Wave 0: Same-day follow-up (manual only — triggered from admin panel) ──
  // Target: signed up today (>2h ago), never got any follow-up, 0 booklets created
  let wave0: NonNullable<typeof allProfiles> = [];
  if (body.sameDay) {
    wave0 = (allProfiles ?? []).filter(p =>
      p.plan !== "admin" &&
      p.followup_sent_at === null &&
      p.created_at <= twoHoursAgo &&
      p.created_at >= oneDayAgo &&
      (bookletsByUser[p.id] ?? 0) === 0
    );

    for (const p of wave0) {
      const name     = p.full_name ? esc(p.full_name.split(" ")[0]) : null;
      const greeting = name ? `שלום ${name}!` : "שלום!";
      const subject  = "עוד לא ניסית? 60 שניות → חוברת מותאמת אישית ✨";
      const html = buildEmailHtml(greeting,
        `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          נרשמת היום לבשבילי — עדיין לא יצרת את החוברת הראשונה שלך 😊
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          זה ממש פשוט: לחצי על אחד מהנושאים בדף הבית (כמו "הבנת הנקרא ג-ד") — הטופס יתמלא אוטומטית,
          ואחר כך רק לחצי "צור חוברת". <strong>תוך 60 שניות יש לך חוברת עבודה מלאה מוכנה להדפסה.</strong>
        </p>
        <div style="background:#f0f0ff;border-radius:12px;padding:16px;margin:0 0 16px;text-align:right;">
          <p style="margin:0 0 6px;color:#6C5CE7;font-weight:bold;font-size:14px;">✨ 3 חוברות ראשונות — חינם לגמרי</p>
          <p style="margin:0;color:#555;font-size:13px;line-height:1.7;">מורות פרטיות חוסכות 3+ שעות הכנה בשבוע · כל חוברת מוכנה ב-60 שניות</p>
        </div>`,
        "צרי את החוברת הראשונה שלך ✨",
        "https://beshvili.com"
      );
      await sendEmail(p.id, subject, html, "followup_sent_at");
    }
  }

  // ── Wave 0E: Emergency re-engagement blast ────────────────────────────────
  // Triggered manually when a large signup wave shows 0 activation.
  // Overrides the followup_sent_at dedup so users who already got Wave 0 also
  // get this (today's only — we don't spam old users).
  // Uses an honest "we noticed you had trouble" framing + personal step-by-step guide.
  let wave0e: NonNullable<typeof allProfiles> = [];
  if (body.emergency) {
    wave0e = (allProfiles ?? []).filter(p =>
      p.plan !== "admin" &&
      p.created_at >= oneDayAgo &&   // today's signups only
      (bookletsByUser[p.id] ?? 0) === 0
    );

    for (const p of wave0e) {
      const name     = p.full_name ? esc(p.full_name.split(" ")[0]) : null;
      const greeting = name ? `שלום ${name}!` : "שלום!";
      const subject  = "שמנו לב שנתקעת — הנה עזרה אישית 🙏";
      const html = buildEmailHtml(greeting,
        `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          נרשמת היום לבשבילי — תודה רבה! 🎉<br>
          שמנו לב שלא יצרת חוברת עדיין — ייתכן שהיה עומס על האפליקציה בגלל גל כניסות גדול היום, ואנחנו מצטערים אם נתקעת.
        </p>
        <div style="background:#fff8e1;border-right:4px solid #F4A02C;border-radius:8px;padding:16px;margin:0 0 16px;text-align:right;">
          <p style="margin:0 0 10px;color:#20184A;font-weight:bold;font-size:15px;">🚀 כך יוצרים חוברת ב-3 לחיצות:</p>
          <ol style="margin:0;padding-right:20px;color:#555;font-size:14px;line-height:2.2;">
            <li>לחצי על נושא (למשל <strong>"➕ כיתה ב — חיבור"</strong>) — הטופס יתמלא לבד</li>
            <li>בדקי שהכל נכון ושנו אם צריך</li>
            <li>לחצי <strong>"צור חוברת"</strong> — תוך 60 שניות החוברת מוכנה! 🎉</li>
          </ol>
        </div>
        <div style="background:#f0f0ff;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center;">
          <p style="margin:0 0 6px;color:#6C5CE7;font-weight:bold;font-size:15px;">🎁 3 חוברות ראשונות — חינם לגמרי</p>
          <p style="margin:0;color:#555;font-size:13px;">מורות פרטיות חוסכות 3+ שעות הכנה בשבוע · כל חוברת ב-60 שניות</p>
        </div>
        <p style="color:#555;font-size:13px;text-align:center;margin:0;">
          יש שאלה? ענה למייל הזה ונעזור 💬
        </p>`,
        "נסי עכשיו — 60 שניות ✨",
        "https://beshvili.com"
      );
      await sendEmail(p.id, subject, html, "followup_sent_at");
    }
  }

  // ── Wave 1: D+2 onboarding follow-up ─────────────────────────────────────
  // Target: FREE users who signed up 2-4 days ago, never received a follow-up.
  // Paid users (teacher/parent/pro) are excluded — they already converted, and
  // the free-trial messaging ("3 חינמיות נשארו") is misleading for paying customers.
  const wave1 = (allProfiles ?? []).filter(p =>
    p.plan === "free" &&
    p.followup_sent_at === null &&
    p.created_at <= twoDaysAgo &&
    p.created_at >= fourDaysAgo
  );

  for (const p of wave1) {
    const name    = p.full_name ? esc(p.full_name.split(" ")[0]) : null;
    const greeting = name ? `שלום ${name}!` : "שלום!";
    const count   = bookletsByUser[p.id] ?? 0;
    const remaining = FREE_LIMIT - count;

    let subject: string, html: string;

    if (count >= FREE_LIMIT) {
      // Used all 3 free — push to upgrade
      subject = "אהבת? שדרגי לפרו — חוברות ללא הגבלה 🚀";
      html = buildEmailHtml(greeting,
        `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          כלו ${FREE_LIMIT} החוברות החינמיות שלך — ראינו שאהבת! 🎉
        </p>
        <div style="background:#f0f0ff;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center;">
          <p style="margin:0;color:#6C5CE7;font-weight:bold;">מורה פרטית חוסכת ~3 שעות הכנה בשבוע עם בשבילי</p>
          <p style="margin:8px 0 0;color:#555;font-size:14px;">20 חוברות לחודש · עד 20 עמודים · מפתח תשובות אוטומטי</p>
        </div>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          תוכנית מורה: <strong style="color:#6C5CE7;">₪59/חודש</strong> — פחות מ-₪3 לחוברת.
          שלחי ביט ויפעיל תוך שעה.
        </p>`,
        "שדרגי עכשיו 🚀",
        "https://beshvili.com"
      );
    } else if (count > 0) {
      // Created 1-2 booklets — encourage to use remaining
      const savedMin = count * 45;
      const savedStr = savedMin >= 60
        ? `${(savedMin / 60).toFixed(1).replace(".0", "")} שעות`
        : `${savedMin} דקות`;
      subject = `יצרת ${count} חוברת — נשארו לך ${remaining} חינמיות! 📚`;
      html = buildEmailHtml(greeting,
        `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          כבר חסכת ~${savedStr} הכנה עם בשבילי 🎉
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          יש לך עוד <strong style="color:#F4A02C;">${remaining} חוברות חינמיות</strong> שמחכות לך.
          נסי נושא אחר, כיתה שונה, עולם תוכן חדש — כל חוברת ב-60 שניות.
        </p>`,
        "צרי חוברת עכשיו ✨",
        "https://beshvili.com"
      );
    } else {
      // Never created — remove onboarding friction
      subject = "עדיין לא ניסית? 60 שניות → חוברת מותאמת אישית ✨";
      html = buildEmailHtml(greeting,
        `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          נרשמת לפני יומיים — אבל עדיין לא יצרת חוברת 😊
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          זה לוקח 60 שניות בלבד: שם התלמיד, הכיתה, הנושא — והAI יוצר חוברת עבודה מלאה מוכנה להדפסה.
          <strong>3 חוברות ראשונות חינם לגמרי.</strong>
        </p>`,
        "נסי עכשיו חינם ✨",
        "https://beshvili.com"
      );
    }

    await sendEmail(p.id, subject, html, "followup_sent_at");
  }

  // ── Wave 2: Dormant re-engagement ────────────────────────────────────────
  // Target: free users who created 1+ booklets, last booklet 5-10 days ago,
  //         never received a dormant followup
  // Strategy: value-first — "הנה רעיון לחוברת הבאה" not "חזרי לאפליקציה"
  // Wave 2 only runs if migration 0020 was applied (dormantByUser != null)
  const wave2 = dormantByUser === null ? [] : (allProfiles ?? []).filter(p => {
    if (p.plan !== "free") return false;
    if ((dormantByUser![p.id] ?? null) !== null) return false; // already sent
    const lastBooklet = lastBookletByUser[p.id];
    if (!lastBooklet) return false;
    return lastBooklet <= fiveDaysAgo && lastBooklet >= tenDaysAgo;
  });

  for (const p of wave2) {
    const name      = p.full_name ? esc(p.full_name.split(" ")[0]) : null;
    const greeting  = name ? `שלום ${name}!` : "שלום!";
    const count     = bookletsByUser[p.id] ?? 0;
    const remaining = FREE_LIMIT - count;
    const savedMin  = count * 45;
    const savedStr  = savedMin >= 60
      ? `${(savedMin / 60).toFixed(1).replace(".0", "")} שעות`
      : `${savedMin} דקות`;

    const subject = remaining > 0
      ? `רעיון לחוברת הבאה שלך — ${remaining} חינמיות נשארו 💡`
      : "ראינו שאהבת — הגיע הזמן לשדרג 🚀";

    const bodyHtml = remaining > 0
      ? `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          כבר חסכת ~${savedStr} עם בשבילי — מגניב! 💪
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          יש לך עוד <strong style="color:#F4A02C;">${remaining} חוברות חינמיות</strong> שמחכות לך.
          הנה כמה רעיונות לנושאים שעובדים מצוין:
        </p>
        <ul style="color:#555;line-height:2;margin:0 0 16px;padding-right:20px;">
          <li>חזרה לקראת מבחן — עם מפתח תשובות אוטומטי</li>
          <li>נושא שהתלמיד מתקשה בו — בדיוק ברמה שלו</li>
          <li>תרגול קיץ — עם עולם תוכן מוטיבציוני</li>
        </ul>`
      : `<p style="color:#555;line-height:1.7;margin:0 0 16px;">
          השתמשת ב-${count} חוברות החינמיות שלך — זה אומר שחסכת ~${savedStr} הכנה! 🎉
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 16px;">
          כדי להמשיך לחסוך זמן כל שבוע — שדרגי לתוכנית מורה:
          20 חוברות לחודש, עד 20 עמודים, מפתח תשובות. <strong style="color:#6C5CE7;">₪59/חודש</strong>.
        </p>`;

    const ctaText = remaining > 0 ? "צרי חוברת עכשיו ✨" : "שדרגי לפרו 🚀";
    const html = buildEmailHtml(greeting, bodyHtml, ctaText, "https://beshvili.com");
    await sendEmail(p.id, subject, html, "dormant_followup_sent_at");
  }

  return new Response(JSON.stringify({
    sent,
    wave0_candidates: wave0.length,
    wave0e_candidates: wave0e.length,
    wave1_candidates: wave1.length,
    wave2_candidates: wave2.length,
    total: wave0.length + wave0e.length + wave1.length + wave2.length,
    errors,
    _debug: {
      profiles_found: (allProfiles ?? []).length,
      auth_users_found: (authData?.users ?? []).length,
      booklets_found: (allBooklets ?? []).length,
      wave2_skipped: dormantByUser === null,
    },
  }), { status: 200, headers: cors });
});
