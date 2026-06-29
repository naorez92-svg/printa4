import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, no-auth unsubscribe endpoint reached from the link in marketing emails:
//   GET /functions/v1/unsubscribe?token=<uuid>
// The token (profiles.unsubscribe_token) is the only credential — unguessable and
// scoped to one user. Sets unsubscribed_at; send-followup / send-renewal-reminder
// skip anyone with it set. Idempotent. Returns a small Hebrew confirmation page.

const page = (title: string, body: string, ok: boolean) => `<!DOCTYPE html>
<html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#F7F6FB;margin:0;padding:40px 20px;text-align:center;color:#20184A">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #eee">
    <div style="font-size:40px;margin-bottom:12px">${ok ? "✅" : "⚠️"}</div>
    <h1 style="font-size:20px;margin:0 0 10px">${title}</h1>
    <p style="color:#555;line-height:1.7;margin:0 0 20px">${body}</p>
    <a href="https://www.beshvili.com" style="display:inline-block;background:linear-gradient(to left,#F4A02C,#6C5CE7);color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:bold">בשבילי ←</a>
  </div>
</body></html>`;

Deno.serve(async (req) => {
  const html = (s: string, status = 200) =>
    new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8" } });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) {
    return html(page("קישור לא תקין", "חסר מזהה הסרה בקישור. אם הגעת לכאן בטעות — אפשר לסגור את הדף.", false), 400);
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("id, unsubscribed_at")
      .eq("unsubscribe_token", token)
      .single();

    if (!profile) {
      return html(page("קישור לא תקין", "לא מצאנו את הכתובת הזו. ייתכן שהקישור פג או שכבר הוסרת.", false), 404);
    }

    if (!profile.unsubscribed_at) {
      await admin.from("profiles").update({ unsubscribed_at: new Date().toISOString() }).eq("id", profile.id);
    }

    return html(page(
      "הוסרת מרשימת התפוצה",
      "לא נשלח אליך יותר מיילים שיווקיים מבשבילי. מצטערים שהפרענו — ותמיד אפשר לחזור.",
      true,
    ));
  } catch (_e) {
    return html(page("שגיאה זמנית", "משהו השתבש. נסה שוב מאוחר יותר, או השב למייל ונסיר אותך ידנית.", false), 500);
  }
});
