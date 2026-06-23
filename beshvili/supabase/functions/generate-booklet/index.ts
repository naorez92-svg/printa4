import { createClient } from "jsr:@supabase/supabase-js@2";

// v3 — variable page count + answer key support
// ── Commercial limits ────────────────────────────────────────────────────────
const FREE_BOOKLET_LIMIT = 2;          // free-tier total
const RATE_LIMIT_SECONDS = 60;         // min gap between generations per user
const MAX_FREE_TEXT_LEN = 2000;
const MAX_FIELD_LEN = 500;
const FREE_MAX_PAGES = 10;
const PRO_MAX_PAGES = 20;

// Supabase JS client sends apikey + x-client-info — must be in allow list
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BOOKLET_SYSTEM = `אתה "יוצר החוברות של חני 2.0" — מומחה פדגוגי בכיר, מעצב גרפי לפרינט ומפתח HTML/CSS.
מטרתך: לייצר קוד HTML מלא לחוברות עבודה לימודיות לילדים ברמה עיצובית גבוהה, חסכוניות בדיו, מוכנות להדפסה בפורמט A4.

=== חוקי CSS A4 (חובה בכל עמוד!) ===
• כל div עמוד: width:210mm; height:296mm; margin:10px auto; overflow:hidden; page-break-after:always; box-sizing:border-box; position:relative; padding:12mm;
• סגנון הדפסה: @page{size:A4;margin:0} @media print{.no-print{display:none!important}}
• שמירת צבעים: -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important

=== עקרונות עיצוב ===
• Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
• Google Fonts: Fredoka לכותרות, Varela Round לטקסט
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Varela+Round&display=swap" rel="stylesheet">
• רקעים בהירים בלבד — bg-white, bg-orange-50, bg-blue-50, bg-green-50, bg-purple-50, bg-yellow-50
• מסגרות מעוצבות: rounded-2xl, shadow-md, border
• אימוג'ים לתמיכה חזותית בכל פעילות
• שורות כתיבה: border-b border-gray-300 h-8 w-full mb-2
• עיצוב עקבי לאורך כל העמודים סביב עולם התוכן של הילד

=== מבנה עמודים (כמות מצוינת בבקשה — חובה לעמוד בה בדיוק!) ===
עמוד 1 — שער אישי והעצמה:
  • כותרת גדולה בומבסטית (Fredoka, 36px+) עם שם הילד/ה
  • "הצהרת מסוגלות" ("אני [שם], ואני יכול/ה!")
  • "תעודת זהות / פרופיל שחקן" מעוצב בעולם התוכן (שם, גיל, חוזקות)
  • הנחיות שימוש בחוברת

עמוד 2 — חימום (ידע וזיהוי):
  • כותרת ברורה
  • משימה חזותית/מהירה שיוצרת הצלחה מיידית
  • 4-6 פריטים קצרים, מגוונים, מהנים

עמוד 3 — ליבת הלמידה (הבנה ויישום):
  • החומר המרכזי מחולק ל-2-3 מקטעים קצרים עם כותרות
  • כל מקטע: הסבר קצר + תרגילים
  • שורות כתיבה לתשובות
  • לפחות 8-10 תרגילים

עמוד 4 — חשיבה מחוץ לקופסה (אנליזה):
  • שאלות מסדר גבוה, בעיות מילוליות, קבלת החלטות
  • לפחות 3-4 שאלות/אתגרים
  • מקום נרחב לכתיבה ורישום

עמוד N-1 (ואילך, אם יש יותר מ-5 עמודים) — תרגול נוסף:
  • 8-10 תרגילים מגוונים נוספים בנושא: בעיות מילוליות, חידות, יצירתיות
  • מקום לכתיבה ורישום

עמוד אחרון — דו"ח סקאוט / רפלקציה:
  • מדד מאמץ (5 כוכבים לסימון: ☆☆☆☆☆)
  • "מה היה קל לי:" (שורות כתיבה)
  • "מה היה מאתגר:" (שורות כתיבה)
  • "מה למדתי היום:" (שורות כתיבה)
  • חתימת הילד/ה + חתימת המורה/מאמנת: חני עזרא
  • תאריך

=== פלט (חשוב מאוד!) ===
• קוד HTML גולמי בלבד — החל מ-<!DOCTYPE html> עד </html>
• ללא \`\`\`html, ללא הסברים, ללא שום טקסט לפני או אחרי
• כפתור הדפסה ממוסגר עם class="no-print" בראש הדף
• עברית תקינה, מלאה ועשירה
• כל העמודים (לפי הכמות שנדרשה) בקובץ HTML אחד

=== ייחוס (חובה!) ===
• בתחתית עמוד הרפלקציה (עמוד אחרון), בתוך ה-div של העמוד, לפני הסגירה, הוסף:
  <p style="position:absolute;bottom:6mm;left:0;right:0;text-align:center;font-size:8px;color:#ccc;margin:0;">נוצר בחינם עם beshvili.app ✨</p>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Admin Supabase client (service role — bypasses RLS for server checks)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // ── 1. JWT verification ──────────────────────────────────────────────
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }

    // ── 2. Plan check + quota (server-enforced, cannot be bypassed) ───────
    const [{ data: profile }, { count: bookletCount }] = await Promise.all([
      admin.from("profiles").select("plan").eq("id", user.id).single(),
      admin.from("booklets").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const isPro = profile?.plan === "pro" || profile?.plan === "admin";
    const usedCount = bookletCount ?? 0;

    if (!isPro && usedCount >= FREE_BOOKLET_LIMIT) {
      return new Response(
        JSON.stringify({ error: "quota_exceeded", used: usedCount, limit: FREE_BOOKLET_LIMIT }),
        { status: 403, headers: cors }
      );
    }

    // ── 3. Rate limiting (1 per 60s per user) ────────────────────────────
    const { data: lastBooklet } = await admin
      .from("booklets")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBooklet?.created_at) {
      const elapsedSec = (Date.now() - new Date(lastBooklet.created_at).getTime()) / 1000;
      if (elapsedSec < RATE_LIMIT_SECONDS) {
        return new Response(
          JSON.stringify({ error: "rate_limited", wait: Math.ceil(RATE_LIMIT_SECONDS - elapsedSec) }),
          { status: 429, headers: cors }
        );
      }
    }

    // ── 4. Parse + sanitize input ────────────────────────────────────────
    const body = await req.json();
    const clean = (val: unknown, max = MAX_FIELD_LEN): string =>
      String(val ?? "").trim().substring(0, max);

    const freeText      = clean(body.freeText, MAX_FREE_TEXT_LEN);
    const childName     = clean(body.childName, 100);
    const grade         = clean(body.grade, 50);
    const world         = clean(body.world, 50);
    const goal          = clean(body.goal);
    const weaknesses    = clean(body.weaknesses, 300);
    const level         = ["basic", "medium", "advanced"].includes(body.level) ? body.level : "medium";
    const maxPages      = isPro ? PRO_MAX_PAGES : FREE_MAX_PAGES;
    const pageCount     = Math.min(maxPages, Math.max(1, Number.isInteger(body.pageCount) ? body.pageCount : 5));
    const withAnswerKey = body.withAnswerKey === true;

    if (!freeText && !goal) {
      return new Response(JSON.stringify({ error: "goal required" }), { status: 400, headers: cors });
    }

    // ── 5. Build AI prompt ───────────────────────────────────────────────
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const answerKeyNote = withAnswerKey
      ? `\nלאחר עמוד הרפלקציה — הוסף עמוד נוסף: "מפתח תשובות — לשימוש המורה/הורה בלבד" עם כל תשובות התרגילים מהחוברת, מסודר לפי מספר עמוד.`
      : "";

    const userMsg = freeText
      ? `צור חוברת עבודה לפי הבקשה הבאה:\n\n${freeText}\n\nצור HTML מלא עם בדיוק ${pageCount} עמודים.${answerKeyNote} קוד HTML גולמי בלבד.`
      : `צור חוברת עבודה עם בדיוק ${pageCount} עמודים:
שם: ${childName || "לא צוין"} | כיתה: ${grade || "לא צוין"} | עולם: ${world || "כללי"}
יעד: ${goal}
רמה: ${level === "basic" ? "בסיסי" : level === "advanced" ? "מתקדם" : "בינוני"}
${weaknesses ? `חולשות לחיזוק: ${weaknesses}` : ""}${answerKeyNote}
קוד HTML גולמי בלבד, ללא הסברים.`;

    // ── 6. Generate (streaming — client receives SSE, sees HTML in real time) ──
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: Math.min(20000, Math.max(8000, pageCount * 1800)),
        stream: true,
        system: BOOKLET_SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!anthropicResp.ok) {
      throw new Error(`Anthropic ${anthropicResp.status}: ${await anthropicResp.text()}`);
    }

    return new Response(anthropicResp.body, {
      headers: {
        ...cors,
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-remaining": String(isPro ? -1 : FREE_BOOKLET_LIMIT - usedCount - 1),
      },
    });

  } catch (e: unknown) {
    const status = (e as { status?: number }).status ?? 500;
    return new Response(JSON.stringify({ error: String(e) }), { status, headers: cors });
  }
});
