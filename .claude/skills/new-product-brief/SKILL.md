---
name: new-product-brief
description: >
  ישיבת ייסוד לפני בנייה של מוצר חדש. מנהל שיחה מובנית ב-9 שלבים
  (PRFAQ → JTBD → Shape Up → מודל עסקי → ארכיטקטורה → DB → עיצוב/מינוח → הפצה → MVP scope)
  ומסיים ב-PRODUCT_BRIEF.md אחד שמונע 80% מהעבודה הכפולה.
user-invocable: true
argument-hint: "[שם המוצר או רעיון קצר — אופציונלי]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - WebSearch
  - WebFetch
---

# ישיבת ייסוד לפני בנייה של מוצר חדש

## מתי להפעיל
כשהמשתמש אומר "אני רוצה לבנות מוצר חדש", "בוא נתחיל אפליקציה", "יש לי רעיון ל-SaaS" — לפני שנכתב שורת קוד אחת.

## מה זה נותן
ישיבה של 45-90 דקות שמייצרת `PRODUCT_BRIEF.md` אחד — מסמך שכל agent עתידי קורא לפני שהוא כותב שורת קוד. המסמך מונע:
- כפילות לוגיקה עסקית (מכסה מוגדרת ב-3 מקומות)
- טקסט שיווקי שלא מחובר לאפליקציה
- מינוח לא מוגדר שמגיע לפרודקשן
- מודל אבטחה שמוגדר בדיעבד
- סכמת DB שדורשת 5 מיגרציות של תיקונים

---

## הוראות לסוכן: 9 שלבים בסדר, אל תדלג

---

### שלב 0 — פתח בהצהרה

```
לפני שורת קוד אחת — ישיבת ייסוד.
9 שלבים, ~45-90 דקות, התוצר: PRODUCT_BRIEF.md.
כל שעה שמשקיעים כאן חוסכת 10 שעות של עבודה כפולה אחר כך.
מוכן?
```

---

### שלב 1 — Amazon PRFAQ: כתוב את כותרת העיתון קודם

> **מקור:** Amazon Working Backwards — Jeff Bezos דרש מכל PM לכתוב "press release מהעתיד" לפני שמתחילים לבנות. אם אתה לא יכול לכתוב את הכותרת — המוצר לא מוגדר מספיק.

**שאל:**

1. **כותרת עיתון:** כתוב משפט אחד כאילו המוצר כבר הצליח ומישהו כותב עליו ב-TechCrunch / Hacker News. פורמט: "[שם המוצר] עוזר ל-[מי] ל-[מה] — [מספר] [יחידה] בשבוע/חודש"

2. **פסקת פתיחה (2 משפטים):** מי הלקוח, מה הבעיה, מה הפתרון.

3. **ציטוט לקוח מדומיין:** מה לקוח מרוצה היה אומר? (משפט אחד, ספציפי — לא "זה מצוין!")

4. **שלושת ה-FAQs החיצוניים שלקוח ישאל:**
   - שאלה 1: [...]
   - שאלה 2: [...]
   - שאלה 3: [...]

5. **שלושת ה-FAQs הפנימיים שהצוות ישאל:**
   - שאלה 1: [...]
   - שאלה 2: [...]
   - שאלה 3: [...]

> ← *הכותרת מהשלב הזה הופכת ל-One-liner של המוצר. כל טקסט אחר באפליקציה יחזק אותה.*

---

### שלב 2 — JTBD: רגע ההיאבקות

> **מקור:** Jobs To Be Done (Bob Moesta, Clay Christensen) — אנשים "שוכרים" מוצרים לבצע עבודות. הזרע של כל חדשנות הוא "רגע ההיאבקות" — הרגע הספציפי שבו הלקוח הבין שהוא צריך פתרון חדש.

**שאל:**

6. **רגע ההיאבקות:** "תאר את הרגע הספציפי האחרון שלקוח פוטנציאלי עצר ואמר 'חייב להיות דרך טובה יותר'. מה היה הטריגר? יום? שעה? מה קדם?"

7. **ארבע הכוחות (Four Forces):**
   - **דחיפה מהנוכחי:** מה כואב בפתרון הנוכחי? (לא "קשה" — ספציפי: "3 שעות כל ראשון בלילה")
   - **משיכה לחדש:** מה הלקוח מדמיין שיקרה אחרי שישתמש? (תמונה עתידית)
   - **חרדה מהמעבר:** מה מפחיד אותו בלנסות? (נתונים, עלות, זמן לימוד?)
   - **הרגל הנוכחי:** מה הוא כבר עושה ועובד (גם אם לא טוב)? לא ישנה בלי סיבה.

8. **פרופיל לקוח ספציפי:** גיל, מקצוע, עד כמה טכני (1-5), כמה הוא ישלם, מאיפה הוא שומע על מוצרים חדשים.

9. **אה-הא מומנט:** מה הרגע הספציפי שבו משתמש חדש מרגיש לראשונה שהמוצר שווה? *כמה שניות/דקות מהרשמה?*
   ← *חשוב: אם ה-aha moment לוקח יותר מ-2 דקות — retention יהיה נמוך. תכנן מה לקצר.*

---

### שלב 3 — Shape Up: Appetite, Rabbit Holes, No-gos

> **מקור:** Shape Up (Ryan Singer / Basecamp) — לא "כמה זמן זה ייקח?" אלא "כמה זמן אנחנו מוכנים להשקיע?" Appetite קובע את ה-scope, לא להיפך. Rabbit Holes הם המקומות שיכולים לבלוע שבועות.

**שאל:**

10. **Appetite:** "כמה שבועות את/ה מוכן/ה להשקיע ב-MVP לפני שמגיעים למשתמשים אמיתיים?"
    - בין 1-2 שבועות (Small Batch)
    - בין 4-6 שבועות (Big Batch)
    - מעל 6 שבועות → ❌ ה-scope גדול מדי. תחלק.

11. **Rabbit Holes — איפה יש סיכון לבזבז יותר מהצפוי?**
    רשום לכל אחד: תיאור + מיטיגציה (פתרון פשוט/עיגול זוויות מקובל)
    - [Rabbit Hole 1]: ...
    - [Rabbit Hole 2]: ...

12. **No-gos מפורשים:** מה *לא* נבנה ב-MVP? (כל feature שלא נרשם כ-"לא עכשיו" יגיע כ-"למה עוד לא?")
    - [ ] לא עכשיו: ...
    - [ ] לא עכשיו: ...

---

### שלב 4 — מודל עסקי ומכסות

> **לקח מהשטח:** מכסת ניסיון חינמית הייתה מוגדרת ב-3 מקומות שונים. כשעדכנו אחד — השניים האחרים לא סונכרנו. פתרון: `constants.ts` אחד, מצוטט משם בכל מקום.

**שאל:**

13. **מודל מחיר:** מלא את הטבלה:
    | תוכנית | מחיר/חודש | מגבלה | מה נפתח |
    |--------|-----------|-------|---------|
    | חינמי  | ₪0        | X     | ...     |
    | פרו    | ₪XX       | Y     | ...     |

14. **היכן חיה המכסה?** ← חוק: DB בלבד + server-side check. לעולם לא client-only.
    - ערך יחיד ב-`constants.ts` (או קובץ שקול)
    - trigger/function ב-DB שמונע עקיפה
    - check ב-Edge Function לפני כל פעולה יקרה

15. **ניסיון לעקוף מכסה:** מה קורה אם משתמש:
    - מוחק ויוצר מחדש? → פתרון: ________________
    - פותח חשבון שני? → פתרון: ________________
    - קורא ל-API ישירות? → פתרון: ________________

16. **Upgrade trigger:** מה הרגע המדויק שמשתמש שומע "שדרג"? מה הטקסט המדויק?
    (המשפט הזה חייב להיות connected ל-aha moment משלב 2)

17. **אמצעי תשלום:** Stripe / Bit / PayPal / ידני? מה ה-friction שמוכנים לקבל ב-MVP?

---

### שלב 5 — ארכיטקטורה טכנית

> **חוק ברזל:** לוגיקה עסקית (מכסות, תשלום, הרשאות) תמיד בצד שרת + DB. לעולם לא client-only.

**שאל:**

18. **Frontend:** React/Vue/Next/Svelte? למה? SSR נדרש (SEO)?

19. **Backend:** Edge Functions / Node / Python / serverless? איפה הלוגיקה העסקית?

20. **DB:** Postgres / Mongo / Firebase? מי מנהל? (Supabase, PlanetScale, Railway?)

21. **Auth:** magic link / Google OAuth / password? מה ה-session strategy?

22. **AI/LLM** (אם רלוונטי):
    ```
    מודל: [claude-opus-4-8 / gpt-4o / אחר]
    streaming או sync?
    output format: [HTML / JSON / Markdown]
    איפה ה-prompt גר: [Edge Function בלבד — לעולם לא client]
    מניעת prompt injection: [sanitize input / system prompt separation]
    ```

23. **Storage:** קבצים/תמונות/PDFs → (Supabase Storage / S3 / Cloudflare R2?)

24. **Real-time:** WebSocket / SSE / polling? לאיזה feature ספציפי?

25. **מפת הסודות (מלא לפני שורת קוד):**
    | Secret | מיקום | לעולם לא |
    |--------|--------|----------|
    | ANTHROPIC_API_KEY | supabase secrets | VITE_* / hardcode |
    | DB_PASSWORD | ... | ... |

26. **CORS Policy:**
    - origins מורשים: production domain + localhost + Vercel previews (regex)
    - origins אסורים: כל שאר
    ← *Vercel preview URLs דינמיות — צריך regex: `/^https:\/\/[repo]-git-[^.]+\.vercel\.app$/`*

27. **OWASP Top 10 checklist:**
    - [ ] XSS: האם מציגים HTML שנוצר ע"י AI/משתמש? → sanitization חובה (DOMPurify)
    - [ ] CSRF: מה מנגנון ה-CSRF protection?
    - [ ] Rate limiting: X requests לדקה per user → מה קורה כשחורגים?
    - [ ] Input validation: אילו שדות מגיעים מהמשתמש? max length? SQL injection?
    - [ ] Secrets: אף secret ב-VITE_* / hardcode / Git
    - [ ] RLS: כל user רואה רק את שלו — נאכף ב-DB level

---

### שלב 6 — סכמת DB

> **לקח מהשטח:** עמודת `total_booklets_created` נוספה במיגרציה 0019 כי לא חשבנו מראש שמשתמשים ימחקו רשומות כדי לאפס מכסה. מיגרציות הן friction — תכנן הכל מראש.

**שאל:**

28. **טבלאות:** רשום כל טבלה עם כל עמודות:
    ```sql
    TABLE users (
      id uuid primary key,
      email text not null,
      plan text default 'free',
      created_at timestamptz default now()
    );
    -- ... כל הטבלאות
    ```

29. **Lifetime counters (חובה!):** אילו metrics לעולם לא מופחתים גם אם רשומות נמחקות?
    ← דוגמה: `total_items_created` — לא `COUNT(items)` אלא counter שרק עולה
    - עמודה: ___ בטבלה: ___
    - מתעדכן ב: [trigger / application code]

30. **שאילתות נפוצות:** אילו queries ירוצו הכי הרבה? יש indexes מתאימים?
    ```sql
    -- שאילתה נפוצה 1:
    CREATE INDEX ON table(column);
    ```

31. **RLS Policy:**
    - `SELECT`: כל user רואה רק `WHERE user_id = auth.uid()`
    - `INSERT`: user יכול ליצור רק בשם עצמו
    - `UPDATE/DELETE`: רק owner
    - יש admins? → מה ה-policy שלהם?

---

### שלב 7 — עיצוב, שפה ומינוח

> **לקח מהשטח:** "מסיון" (מילה לא קיימת) הגיעה לפרודקשן כי לא הייתה רשימת מינוח מאושרת. תוקנה רק כשמשתמש ראה בפועל.

**שאל:**

32. **Design Tokens (מלא — יוגדרו פעם אחת ב-tailwind.config.js):**
    ```js
    colors: {
      primary:    '#___',  // שם: ___
      secondary:  '#___',  // שם: ___
      background: '#___',  // שם: ___
      text:       '#___',  // שם: ___
      success:    '#___',  // שם: ___
      warning:    '#___',  // שם: ___
    }
    ```
    ← לעולם לא hard-coded hex בקומפוננטים — תמיד class tokens

33. **שפה ו-RTL:**
    - שפה ראשית: עברית / אנגלית / דו-לשוני?
    - אם עברית: `dir="rtl"` על `<body>` + כל modal/tooltip
    - מי כותב את הטקסטים? AI prompt? אדם ספציפי?

34. **מינוח מאושר (10+ מושגים):**
    | מושג | הצורה הנכונה | אסור לכתוב |
    |------|-------------|-----------|
    | ... | ... | ... |
    ← *הרשימה הזאת מועברת word-for-word לכל AI prompt שמייצר content*

35. **Empty states & Errors:**
    - empty list: "___"
    - error 404: "___"
    - error 500: "___"
    - טון: [מקצועי / ידידותי / מצחיק]

36. **Loading experience:** spinner / skeleton / progress bar / הודעות מתחלפות?

---

### שלב 8 — הפצה ולונץ'

> **מקורות:** Product Hunt playbook + Indie Hackers insights — Distribution קשה יותר מהטכנולוגיה. 400 אנשים חמים לפני לונץ' הם ההבדל בין #1 Product of the Day לאנונימיות.

**שאל:**

37. **מי 10 האנשים הראשונים שישתמשו?** (שמות, לא פלחי שוק)
    ← *Indie Hackers: validate עם אנשים אמיתיים לפני שכותבים קוד*

38. **ערוץ הפצה ראשי:** Whatsapp groups / Facebook / LinkedIn / email list / Product Hunt / SEO?
    - מה ה-distribution advantage שלך? (גישה לקהל שלאחרים אין?)

39. **Pre-launch list:** כמה אנשים ברשימת המתנה לפני launch?
    - פחות מ-50: ← עצור, תבנה קהל קודם
    - 50-200: ← soft launch רק לרשימה
    - 200+: ← אפשר Product Hunt
    - 400+: ← אפשר לצפות ל-Top 5

40. **Aha moment timing:** מה נדרש מרגע ההרשמה עד שהמשתמש חווה ערך?
    - יותר מ-2 דקות: ← מסוכן, מה אפשר לקצר?
    - מה ה-activation metric? (הפעולה שמגדירה "משתמש שהבין את הערך")

41. **Analytics מינימלי לפני launch:**
    - [ ] event: "user_signed_up"
    - [ ] event: "first_[core_action]" (ה-aha moment)
    - [ ] event: "upgrade_intent" (מי לחץ שדרג)
    - כלי: PostHog / Mixpanel / Plausible / אחר?

---

### שלב 9 — MVP Scope ומדדי הצלחה

**שאל:**

42. **בתוך ה-MVP:** (רשימה — כל feature שחייב להיות ביום 1)
    - [ ] ...
    - [ ] ...

43. **מחוץ ל-MVP (לא עכשיו!):**
    - [ ] לא עכשיו: ...
    - [ ] לא עכשיו: ...
    ← *כל feature שלא נרשם כ-"לא עכשיו" יגיע כ-"למה עוד לא?"*

44. **מדד הצלחה ב-MVP:** (מספר ספציפי + תאריך)
    - [ ] X משתמשים פעילים עד [תאריך]
    - [ ] Y ₪ MRR עד [תאריך]
    - [ ] Z% retention (שבועי)

45. **הסיכון הגדול ביותר שיכול להרוג את המוצר:**
    - סיכון 1 (טכני/שיווקי/משפטי): ___ → מיטיגציה: ___
    - סיכון 2: ___ → מיטיגציה: ___

---

## תפוקת הסקיל — PRODUCT_BRIEF.md

אחרי שאספת את כל התשובות, צור קובץ `PRODUCT_BRIEF.md` עם המבנה הבא:

```markdown
# PRODUCT_BRIEF.md — [שם המוצר]
> נוצר: [תאריך] | Appetite: [X שבועות] | Launch target: [תאריך]

---

## 1. Press Release (PRFAQ)
**כותרת:** "[One-liner שיגרום ל-10 אנשים לתת מייל]"

**פסקת פתיחה:** [מי הלקוח, מה הבעיה, מה הפתרון]

**ציטוט לקוח:** "[משפט ספציפי מלקוח מרוצה]"

**FAQs חיצוניים:**
1. ...

**FAQs פנימיים:**
1. ...

← ה-One-liner הזה חייב להופיע word-for-word ב: דף נחיתה, Dashboard welcome, UpgradeModal

---

## 2. JTBD — רגע ההיאבקות
**הרגע הספציפי:** [מה קרה, מתי, מה הטריגר]

**Four Forces:**
| כוח | תיאור |
|-----|-------|
| דחיפה | [מה כואב בנוכחי — ספציפי] |
| משיכה | [מה הלקוח מדמיין] |
| חרדה | [מה מפחיד] |
| הרגל | [מה כבר עובד] |

**Aha moment:** [הרגע + כמה זמן מהרשמה]

---

## 3. Shape Up
**Appetite:** [X שבועות] (לא estimate — זה ה-budget)

**Rabbit Holes:**
- [תיאור] → מיטיגציה: [פתרון פשוט]

**No-gos מפורשים (לא עכשיו!):**
- [ ] [feature]
- [ ] [feature]

---

## 4. מודל עסקי
| תוכנית | מחיר | מגבלה | אכיפה |
|--------|------|--------|-------|
| חינמי  | ₪0   | X [יחידה] lifetime | DB trigger + Edge Function check |
| פרו    | ₪XX  | Y/חודש | ... |

```
FREE_LIMIT = X  // constants.ts — ערך יחיד, מצוטט משם בכל מקום
```

**Upgrade trigger:** "[הטקסט המדויק שמשתמש רואה]"

---

## 5. ארכיטקטורה
```
Frontend: [framework] — [סיבה]
Backend:  [Edge Functions / Node] — לוגיקה עסקית כאן
Auth:     [magic link / OAuth] — session: [JWT / cookie]
AI:       model=[...], location=Edge Function ONLY, prompt=server-side ONLY
DB:       [Postgres] מנוהל ע"י [Supabase]
Storage:  [כלי] — לאיזה סוגי קבצים
```

---

## 6. מפת סודות
| Secret | מיקום | לעולם לא |
|--------|--------|----------|
| API_KEY | supabase secrets | VITE_* |
| ... | ... | ... |

**CORS Policy:**
- מורשים: [domain], localhost:XXXX, /regex לpreviews/
- אסורים: כל שאר

**OWASP Checklist:**
- [ ] XSS sanitization: [DOMPurify / server-side]
- [ ] Rate limiting: [X/דקה per user]
- [ ] Input validation: max lengths per field
- [ ] RLS: כל טבלה עם policy

---

## 7. סכמת DB
```sql
-- [כל הטבלאות עם כל העמודות]
TABLE profiles (
  id uuid primary key references auth.users,
  plan text default 'free',
  ...
);
```

**Lifetime counters (לעולם לא מופחתים):**
- `[column]` ב-`[table]` — מתעדכן ב-[trigger/code]

**Indexes:**
```sql
CREATE INDEX ON [table]([column]); -- [סיבה]
```

**RLS:**
- SELECT: `WHERE user_id = auth.uid()`
- INSERT/UPDATE/DELETE: owner only

---

## 8. Design Tokens
```js
// tailwind.config.js — לעולם לא hard-coded hex בקומפוננטים
colors: {
  primary:    '#xxx',  // [שם]
  background: '#xxx',  // [שם]
  text:       '#xxx',  // [שם]
  success:    '#xxx',  // [שם]
}
```

**שפה:** [עברית/אנגלית] | RTL: [כן/לא] | `dir="rtl"` על: [body / כל modal]

---

## 9. מינוח מאושר
| מושג | הנכון | אסור |
|------|-------|------|
| ... | ... | ... |

← העתק רשימה זו לכל AI prompt שמייצר content

---

## 10. הפצה ולונץ'
**10 משתמשים ראשונים:** [שמות / קהילות ספציפיות]

**ערוץ ראשי:** [WhatsApp / Facebook / LinkedIn / Product Hunt]

**Pre-launch list:** [מספר אנשים]

**Activation metric (ה-aha moment):** [הפעולה] — צריך לקרות תוך [X] דקות

**Analytics events:**
- `user_signed_up`
- `first_[core_action]`
- `upgrade_intent`

---

## 11. MVP Scope
**בפנים:**
- [ ] ...

**בחוץ (לא עכשיו!):**
- [ ] ...

**מדד הצלחה:** [מספר] [יחידה] עד [תאריך]

**סיכונים:**
1. [סיכון] → מיטיגציה: [פתרון]

---
```

---

## Pre-Code Checklist — לפני שורת קוד ראשונה

- [ ] One-liner מוגדר ומופיע word-for-word בדף נחיתה, Dashboard welcome, UpgradeModal
- [ ] `constants.ts` נוצר עם כל הקבועים העסקיים (מכסות, מחירים, limits)
- [ ] כל secret ממופה למיקומו — אף אחד לא ב-VITE_* או hardcode
- [ ] סכמת DB מאושרת לפני מיגרציה ראשונה (כולל lifetime counters)
- [ ] RLS policy מוגדרת לפני שה-DB עולה לאוויר
- [ ] מינוח מאושר לפני שכותבים copy כלשהו (כולל ב-AI prompts!)
- [ ] CORS policy כתובה לפני שה-Edge Function עולה
- [ ] Aha moment עולה תוך 2 דקות — אחרת תכנן מה לקצר
- [ ] Analytics events מוגדרים לפני launch (3 events מינימום)
- [ ] לפחות 50 אנשים שמחכים לפני שפותחים לציבור

---

## הערה לסוכן

אל תדלג על שאלות. "נחליט אחר כך" הוא התשובה שגורמת ל-refactor בשבוע 4.
אם התשובה לשאלה היא "לא יודע" — רשום `TBD + [תאריך יעד להחלטה]`.
אם שאלה לא רלוונטית למוצר הספציפי — רשום `N/A + סיבה`.

הישיבה הזאת אמורה לקחת 45-90 דקות. כל שעה שמשקיעים כאן חוסכת 10 שעות עבודה כפולה.
