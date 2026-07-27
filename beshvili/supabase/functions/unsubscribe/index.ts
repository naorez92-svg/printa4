import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, no-auth unsubscribe endpoint reached from the link in marketing emails:
//   GET  /functions/v1/unsubscribe?token=<uuid>  → confirmation page (no side effect)
//   POST /functions/v1/unsubscribe?token=<uuid>  → sets unsubscribed_at (also the
//        RFC 8058 List-Unsubscribe-Post one-click target)
// The token (profiles.unsubscribe_token) is the only credential — unguessable and
// scoped to one user. The mailers skip anyone with unsubscribed_at set. Idempotent.

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

    // GET only CONFIRMS — the actual opt-out happens on POST. Corporate mail
    // scanners and link-preview bots follow every GET in an email, so a GET
    // side effect silently unsubscribed real users who never clicked. RFC 8058
    // one-click (List-Unsubscribe-Post) sends POST, so it still works directly.
    if (req.method === "GET" && !profile.unsubscribed_at) {
      return html(page(
        "הסרה מרשימת התפוצה",
        `לחצי על הכפתור כדי לאשר שלא יישלחו אליך יותר מיילים שיווקיים מבשבילי.<br><br>
         <form method="post" action="?token=${token}" style="margin:0">
           <button type="submit" style="background:#20184A;color:#fff;border:none;padding:12px 28px;border-radius:12px;font-weight:bold;font-size:15px;cursor:pointer">אישור הסרה</button>
         </form>`,
        true,
      ));
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
