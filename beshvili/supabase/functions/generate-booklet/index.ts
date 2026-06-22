import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

=== מבנה 5 עמודים (חובה בדיוק!) ===
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

עמוד 5 — דו"ח סקאוט / רפלקציה:
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
• כל 5 העמודים בקובץ HTML אחד`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { childName, grade, world, goal, level, weaknesses, freeText } = await req.json();
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

    const userMsg = freeText?.trim()
      ? `צור חוברת עבודה לפי הבקשה הבאה:\n\n${freeText.trim()}\n\nצור HTML מלא עם כל 5 העמודים לפי המבנה הפדגוגי. קוד HTML גולמי בלבד, ללא הסברים.`
      : `צור חוברת עבודה לפי הפרמטרים הבאים:

שם הילד/ה: ${childName || "לא צוין"}
גיל/כיתה: ${grade || "לא צוין"}
עולם תוכן: ${world || "כללי"}
יעד פדגוגי: ${goal}
רמת אתגר: ${level === "basic" ? "בסיסי" : level === "advanced" ? "מתקדם" : "בינוני"}
${weaknesses ? `התמקד בחולשות מהפעם הקודמת: ${weaknesses}.` : ""}

צור HTML מלא עם כל 5 העמודים לפי המבנה הפדגוגי. קוד HTML גולמי בלבד, ללא הסברים.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 10000,
        system: BOOKLET_SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const html = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    const usage = data.usage ?? {};

    return new Response(JSON.stringify({ html, usage }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
