// Weekly marketing kit — the autonomous content engine.
// Every Sunday (GitHub Actions cron) this function:
//   1. Looks up this week's parasha (Hebcal API)
//   2. Has Claude write ready-to-paste Hebrew posts (teacher WhatsApp groups,
//      Facebook, Instagram) tied to Beshvili's Jewish-studies generator,
//      each with UTM-tagged links so the daily report attributes signups
//   3. Emails the kit to the owner — copy, paste, done.
// Auth: CRON_SECRET (fail closed) — deployed with --no-verify-jwt.

export {}; // ESM marker — lets tooling parse the TS annotations correctly

const OWNER_EMAIL = "naorez92@gmail.com";
const SITE = "https://beshvili.com";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !resendKey) {
    return new Response(JSON.stringify({ error: "missing_secrets" }), { status: 500 });
  }

  try {
    // 1. This week's parasha (Jerusalem; M=on includes Havdalah weeks properly)
    let parasha = "";
    try {
      const hc = await fetch("https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&M=on", {
        signal: AbortSignal.timeout(10_000),
      });
      const hcData = await hc.json();
      const item = (hcData?.items ?? []).find((i: { category: string }) => i.category === "parashat");
      parasha = item?.hebrew ?? item?.title ?? "";
    } catch { /* fall through — kit still works without the parasha hook */ }

    const weekTag = new Date().toISOString().slice(0, 10);
    const utm = (source: string) =>
      `${SITE}/?utm_source=${source}&utm_medium=organic&utm_campaign=weekly_${weekTag}`;

    // 2. Write the kit
    const prompt = `אתה קופירייטר שיווקי מומחה לקהל מורות והורים בישראל.
המוצר: "בשבילי" (beshvili.com) — יוצר בעזרת AI חוברות לימוד אישיות מוכנות להדפסה בעברית: חשבון, עברית, אנגלית — והתמחות בחומרי יהדות לפי תוכנית מפמ"ר (דפי עבודה, מבחנים, סיכומים). 2 חוברות חינם, בלי כרטיס אשראי.
${parasha ? `פרשת השבוע: ${parasha}` : ""}

כתוב ערכת שיווק שבועית בעברית, בטון חם ואותנטי (לא "מכירתי"), עם אימוג'ים במידה. בדיוק במבנה הזה:

### פוסט לקבוצות וואטסאפ של מורות
(3-5 שורות. פתיח מסקרן${parasha ? ` שמתחבר לפרשת ${parasha}` : ""}, ערך אמיתי למורה, וסיום עם הקישור: ${utm("whatsapp")})

### פוסט לפייסבוק (קבוצות הורים/מורות)
(5-8 שורות, סיפורי יותר, שאלה שמזמינה תגובות, הקישור: ${utm("facebook")})

### כיתוב לאינסטגרם
(2-4 שורות + 5-8 האשטגים בעברית, הקישור: ${utm("instagram")})

### טיפ השבוע למורה
(2-3 שורות של ערך נטו בלי קידום — בונה אמון בקבוצות)

בלי הקדמות ובלי הסברים — רק הערכה עצמה.`;

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!ai.ok) {
      console.error("weekly-marketing-kit anthropic:", ai.status);
      return new Response(JSON.stringify({ error: "ai_failed" }), { status: 502 });
    }
    const aiData = await ai.json();
    const kit = (aiData?.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    if (!kit) return new Response(JSON.stringify({ error: "empty_kit" }), { status: 502 });

    // 3. Email it (plain sections → simple styled email; kit text is escaped)
    const esc = (v: string) => v
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const kitHtml = esc(kit)
      .replace(/^### (.+)$/gm, '<h3 style="color:#6C5CE7;margin:22px 0 8px;font-size:16px;">$1</h3>')
      .replace(/\n/g, "<br/>");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "בשבילי <hello@beshvili.com>",
        to: [OWNER_EMAIL],
        subject: `📣 ערכת השיווק השבועית${parasha ? ` — ${parasha}` : ""} · מוכנה להדבקה`,
        html: `<!DOCTYPE html><html dir="rtl" lang="he"><body style="font-family:Arial,sans-serif;background:#F7F6FB;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:28px;border:1px solid #eee;">
    <h2 style="color:#20184A;margin:0 0 4px;">📣 ערכת השיווק השבועית</h2>
    <p style="color:#888;font-size:13px;margin:0 0 18px;">העתק כל פוסט למקום שלו — 2 דקות עבודה. הקישורים מתויגים, אז בדוח היומי תראה בדיוק כמה נרשמו מכל ערוץ.</p>
    <div style="font-size:14px;color:#333;line-height:1.7;">${kitHtml}</div>
    <p style="color:#aaa;font-size:11px;text-align:center;margin:24px 0 0;">בשבילי · מנוע השיווק האוטומטי · נשלח כל יום ראשון</p>
  </div></body></html>`,
      }),
    });
    if (!res.ok) {
      console.error("weekly-marketing-kit resend:", await res.text());
      return new Response(JSON.stringify({ error: "email_failed" }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, parasha }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-marketing-kit error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
  }
});
