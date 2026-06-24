import { createClient } from "jsr:@supabase/supabase-js@2";

// Called daily by GitHub Actions cron with service role key as Bearer token
// OR manually by an admin user from the admin panel

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  // Authorize: accept service role key (cron) or admin JWT
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (token !== serviceRoleKey) {
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "admin") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  // Users who signed up 2-4 days ago and haven't received a follow-up yet
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingProfiles } = await admin
    .from("profiles")
    .select("id, created_at")
    .is("followup_sent_at", null)
    .lte("created_at", twoDaysAgo)
    .gte("created_at", fourDaysAgo);

  if (!pendingProfiles?.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No users to follow up with today" }), { status: 200 });
  }

  const userIds = pendingProfiles.map(p => p.id);

  // Get booklet counts for these users
  const { data: booklets } = await admin.from("booklets").select("user_id").in("user_id", userIds);
  const bookletsByUser: Record<string, number> = {};
  (booklets ?? []).forEach(b => { bookletsByUser[b.user_id] = (bookletsByUser[b.user_id] ?? 0) + 1; });

  // Get emails
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId: Record<string, string> = {};
  (authData?.users ?? []).forEach(u => { if (u.email) emailByUserId[u.id] = u.email; });

  let sent = 0;
  const errors: string[] = [];

  for (const profile of pendingProfiles) {
    const email = emailByUserId[profile.id];
    if (!email) continue;

    const count = bookletsByUser[profile.id] ?? 0;
    const hasCreated = count > 0;
    const usedAll = count >= 2;

    const subject = usedAll
      ? "אהבת? שדרגי לפרו — חוברות ללא הגבלה 🚀"
      : hasCreated
      ? `יצרת ${count} חוברת — יש לך עוד ${2 - count} חינמיות! 📚`
      : "עדיין לא ניסית? 60 שניות → חוברת מותאמת אישית ✨";

    const ctaText = usedAll ? "שדרגי עכשיו 🚀" : "צרי חוברת עכשיו ✨";
    const bodyText = usedAll
      ? "כלו 2 החוברות החינמיות שלך — ראינו שאהבת! שדרגי לפרו ותקבלי חוברות ללא הגבלה, עד 20 עמודים, מפתח תשובות אוטומטי ותמיכה אישית."
      : hasCreated
      ? `יצרת ${count} חוברת — מגניב! יש לך עוד ${2 - count} חינמיות שמחכות לך. נסי עוד נושא, כיתה אחרת, עולם תוכן שונה.`
      : "נרשמת לפני יומיים — אבל עדיין לא יצרת חוברת 😊 זה לוקח 60 שניות: שם הילד, הכיתה, הנושא — והAI יוצר חוברת מלאה מוכנה להדפסה!";

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:white;border-radius:16px;padding:32px;border:1px solid #eee;">
    <div style="font-size:32px;text-align:center;margin-bottom:16px;">📚</div>
    <h2 style="color:#20184A;text-align:center;margin:0 0 16px;">שלום!</h2>
    <p style="color:#555;line-height:1.7;margin:0 0 24px;">${bodyText}</p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://beshvili.com"
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

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "בשבילי <hello@beshvili.com>",
        to: [email],
        subject,
        html,
      }),
    });

    if (resendRes.ok) {
      await admin.from("profiles").update({ followup_sent_at: now.toISOString() }).eq("id", profile.id);
      sent++;
    } else {
      const txt = await resendRes.text();
      errors.push(`${email}: ${txt}`);
    }
  }

  return new Response(JSON.stringify({ sent, total: pendingProfiles.length, errors }), { status: 200 });
});
