// מצפן (Compass) — question banks for the career-guidance journey.
// All content is Hebrew, aimed at Israeli young adults (17–30) at a career crossroads.
// Instruments: RIASEC (Holland) interests, work values, Big Five (short), cognitive
// mini-challenges (scored), and open reflective questions.

// ── Journey stages (order matters — the engine walks this list) ──
export const STAGES = [
  { id: "welcome",    label: "פתיחה" },
  { id: "background", label: "היכרות",            icon: "👋", minutes: 3 },
  { id: "riasec",     label: "מפת התשוקות",       icon: "🧭", minutes: 5 },
  { id: "values",     label: "מה באמת חשוב לך",   icon: "💎", minutes: 3 },
  { id: "bigfive",    label: "מי אתה באמת",        icon: "🪞", minutes: 4 },
  { id: "cognitive",  label: "אתגר המחשבה",        icon: "🧠", minutes: 6 },
  { id: "open",       label: "שאלות עומק",         icon: "✍️", minutes: 8 },
  // Adaptive: the scenario list is CHOSEN per user from their RIASEC results.
  { id: "scenarios",  label: "בדיקת מציאות",        icon: "🎬", minutes: 3 },
  // ai: true → the stage calls the Edge Function and therefore requires login.
  { id: "interview",  label: "ראיון אישי",          icon: "🎙️", minutes: 10, ai: true },
  { id: "paywall",    label: "הפקת הדוח",           icon: "🎁", ai: true },
  { id: "analysis",   label: "ניתוח",               icon: "🔮", minutes: 3, ai: true },
  { id: "report",     label: "המצפן שלך", ai: true },
];

export const STAGE_INTROS = {
  background: {
    title: "בוא נכיר",
    text: "כמה שאלות קצרות כדי להבין איפה אתה עומד היום. אין תשובות נכונות — רק כנות.",
  },
  riasec: {
    title: "מפת התשוקות",
    text: "לכל שאלה — דמיין שאתה עושה את הדבר הזה יום-יום. עד כמה זה מושך אותך? ענה מהבטן, בלי לחשוב יותר מדי.",
  },
  values: {
    title: "מה באמת חשוב לך",
    text: "קריירה טובה על הנייר יכולה להרגיש ריקה אם היא מתנגשת עם הערכים שלך. דרג עד כמה כל דבר חשוב לך — באמת, לא מה ש\"אמור\" להיות חשוב.",
  },
  bigfive: {
    title: "מי אתה באמת",
    text: "עד כמה כל משפט מתאר אותך? חשוב על איך שאתה מתנהג בפועל — לא איך שהיית רוצה להיות.",
  },
  cognitive: {
    title: "אתגר המחשבה",
    text: "8 חידות קצרות שממפות את החוזקות החשיבתיות שלך — מספרים, מילים והיגיון. זה לא מבחן, אין ציון עובר. פשוט תעשה כמיטב יכולתך.",
  },
  open: {
    title: "שאלות עומק",
    text: "כאן קורה הקסם. חמש שאלות שדורשות עצירה אמיתית. כתוב בחופשיות — כמה משפטים לפחות לכל שאלה. ככל שתיתן יותר, המצפן שלך יהיה מדויק יותר.",
  },
  scenarios: {
    title: "בדיקת מציאות",
    text: "לפי מה שגילינו עליך עד עכשיו, בחרנו כמה תרחישי יום-יום שכנראה קרובים אליך. דמיין שזה היום-יום שלך בעוד שנתיים — וענה מהבטן: כמה זה אתה?",
  },
  interview: {
    title: "ראיון אישי",
    text: "עברתי על כל מה שכתבת. עכשיו יש לי שאלות שמכוונות בדיוק אליך — כמו שיחה עם פסיכולוג תעסוקתי. בסוף הראיון גם אחדד איתך את הכיוונים שמסתמנים. ענה בכנות ובהרחבה.",
  },
};

// ── Likert scale labels ──
export const INTEREST_SCALE = ["בכלל לא", "קצת", "בינוני", "די הרבה", "מאוד!"];
export const AGREE_SCALE    = ["ממש לא אני", "פחות אני", "לפעמים", "די אני", "לגמרי אני"];
export const VALUE_SCALE    = ["לא חשוב לי", "קצת חשוב", "חשוב", "חשוב מאוד", "קריטי לי"];

// ── RIASEC — 30 items, 5 per type. prompt: "עד כמה היית נהנה…" ──
export const RIASEC_TYPES = {
  R: "מעשי-טכני", I: "חוקר-אנליטי", A: "יוצר-אמנותי",
  S: "חברתי-מטפל", E: "יזם-מוביל", C: "מארגן-מדויק",
};

export const RIASEC_ITEMS = [
  { id: "r1", type: "R", text: "לתקן משהו מקולקל — רכב, אופניים, מכשיר חשמלי" },
  { id: "i1", type: "I", text: "לפצח בעיה לוגית או מתמטית מסובכת" },
  { id: "a1", type: "A", text: "ליצור משהו חדש — מוזיקה, ציור, וידאו, כתיבה" },
  { id: "s1", type: "S", text: "לעזור למישהו שעובר תקופה קשה" },
  { id: "e1", type: "E", text: "לשכנע אנשים ברעיון שאתה מאמין בו" },
  { id: "c1", type: "C", text: "לארגן מידע ולעשות סדר בבלגן" },
  { id: "r2", type: "R", text: "לעבוד בחוץ — שטח, טבע, בנייה, חקלאות" },
  { id: "i2", type: "I", text: "להבין לעומק איך משהו עובד — טכנולוגיה, גוף האדם, כלכלה" },
  { id: "a2", type: "A", text: "לעצב — גרפיקה, חללים, מוצרים, אופנה" },
  { id: "s2", type: "S", text: "ללמד או להדריך אנשים" },
  { id: "e2", type: "E", text: "להוביל צוות ולקבל את ההחלטות" },
  { id: "c2", type: "C", text: "לעבוד עם מספרים, טבלאות ותקציבים" },
  { id: "r3", type: "R", text: "להרכיב ולבנות דברים בידיים" },
  { id: "i3", type: "I", text: "לקרוא מאמרים ומחקרים על נושא שמסקרן אותך" },
  { id: "a3", type: "A", text: "להופיע מול קהל — משחק, נגינה, הרצאה" },
  { id: "s3", type: "S", text: "להקשיב לאנשים ולעזור להם למצוא פתרון" },
  { id: "e3", type: "E", text: "להקים עסק או מיזם משלך" },
  { id: "c3", type: "C", text: "לתכנן לוח זמנים מדויק ולעמוד בו" },
  { id: "r4", type: "R", text: "להפעיל מכונות, כלים או ציוד טכני" },
  { id: "i4", type: "I", text: "לנתח נתונים ולגלות בהם דפוסים נסתרים" },
  { id: "a4", type: "A", text: "לכתוב — סיפורים, תסריטים, תוכן" },
  { id: "s4", type: "S", text: "לעבוד בצוות שמרגיש כמו משפחה" },
  { id: "e4", type: "E", text: "לנהל משא ומתן ולסגור עסקה" },
  { id: "c4", type: "C", text: "לבדוק פרטים קטנים ולוודא שהכל מדויק" },
  { id: "r5", type: "R", text: "עבודה שכוללת תנועה ומאמץ פיזי" },
  { id: "i5", type: "I", text: "לתכנן ניסוי כדי לבדוק אם השערה נכונה" },
  { id: "a5", type: "A", text: "למצוא פתרון לא שגרתי שאף אחד לא חשב עליו" },
  { id: "s5", type: "S", text: "לטפל באנשים — בריאות, רווחה, חינוך" },
  { id: "e5", type: "E", text: "לקחת אחריות כשכולם מחכים שמישהו יחליט" },
  { id: "c5", type: "C", text: "לעבוד לפי תהליך ברור ומוגדר מראש" },
];

// ── Work values — 12 items ──
export const VALUES_ITEMS = [
  { id: "v1",  text: "ביטחון כלכלי — לדעת שהמשכורת מגיעה" },
  { id: "v2",  text: "איזון בין עבודה לחיים — זמן למשפחה, חברים ותחביבים" },
  { id: "v3",  text: "השפעה — לדעת שהעבודה שלי משנה משהו בעולם" },
  { id: "v4",  text: "הכרה ויוקרה — שיעריכו ויכבדו את מה שאני עושה" },
  { id: "v5",  text: "יצירתיות — מרחב להביא רעיונות משלי" },
  { id: "v6",  text: "עצמאות — להיות הבוס של עצמי" },
  { id: "v7",  text: "אתגר אינטלקטואלי — עבודה שמפעילה לי את הראש" },
  { id: "v8",  text: "אנשים — עבודה שבנויה על קשר אנושי" },
  { id: "v9",  text: "יציבות וודאות — מסלול ברור בלי הפתעות" },
  { id: "v10", text: "התפתחות — ללמוד ולגדול כל הזמן" },
  { id: "v11", text: "משמעות ושליחות — תחושה שאני כאן בשביל משהו" },
  { id: "v12", text: "פוטנציאל הכנסה גבוה — אפשרות להרוויח הרבה" },
];

// ── Big Five — 20 items, 4 per trait, reversed marked ──
export const BIG5_TRAITS = {
  O: "פתיחות לחוויות", C: "מצפוניות והתמדה", E: "מוחצנות",
  A: "נעימות ואמפתיה", N: "יציבות רגשית",
};

export const BIG5_ITEMS = [
  { id: "o1", trait: "O", text: "רעיונות חדשים ומופשטים מסקרנים אותי" },
  { id: "c1", trait: "C", text: "כשאני מתחיל משהו — אני מסיים אותו" },
  { id: "e1", trait: "E", text: "להיות עם אנשים ממלא אותי באנרגיה" },
  { id: "a1", trait: "A", text: "חשוב לי שאנשים סביבי ירגישו בנוח" },
  { id: "n1", trait: "N", text: "אני נשאר רגוע גם במצבי לחץ" },
  { id: "o2", trait: "O", text: "אני אוהב לנסות דברים שמעולם לא ניסיתי" },
  { id: "c2", trait: "C", text: "אני מתכנן קדימה במקום לזרום" },
  { id: "e2", trait: "E", text: "קל לי לפתוח שיחה עם אנשים חדשים" },
  { id: "a2", trait: "A", text: "אני נוטה לתת אמון באנשים" },
  { id: "n2", trait: "N", text: "אני דואג הרבה, גם מדברים קטנים", reversed: true },
  { id: "o3", trait: "O", text: "אני מעדיף את המוכר והבדוק על פני החדש", reversed: true },
  { id: "c3", trait: "C", text: "אני דוחה דברים לרגע האחרון", reversed: true },
  { id: "e3", trait: "E", text: "אחרי יום עמוס עם אנשים אני חייב זמן לבד", reversed: true },
  { id: "a3", trait: "A", text: "בוויכוח, חשוב לי יותר לנצח מאשר להבין", reversed: true },
  { id: "n3", trait: "N", text: "מצב הרוח שלי יציב לאורך היום" },
  { id: "o4", trait: "O", text: "אמנות, מוזיקה או יופי מרגשים אותי באמת" },
  { id: "c4", trait: "C", text: "סדר וארגון חשובים לי בחיי היומיום" },
  { id: "e4", trait: "E", text: "בקבוצה, אני בדרך כלל זה שמדבר" },
  { id: "a4", trait: "A", text: "קל לי להרגיש מה עובר על אנשים אחרים" },
  { id: "n4", trait: "N", text: "ביקורת מערערת אותי יותר ממה שהייתי רוצה", reversed: true },
];

// ── Cognitive mini-challenges — 8 items, multiple choice, scored ──
// domains: num (numerical), verbal, logic
export const COGNITIVE_ITEMS = [
  {
    id: "q1", domain: "num",
    text: "המשך את הסדרה: 2, 6, 12, 20, 30, ...",
    options: ["36", "40", "42", "44"], correct: 2,
  },
  {
    id: "q2", domain: "verbal",
    text: "רופא : חולה — כמו — עורך־דין : ?",
    options: ["שופט", "לקוח", "חוק", "בית משפט"], correct: 1,
  },
  {
    id: "q3", domain: "num",
    text: "המשך את הסדרה: 3, 5, 9, 17, 33, ...",
    options: ["49", "57", "65", "66"], correct: 2,
  },
  {
    id: "q4", domain: "logic",
    text: "כל הכלכלנים אוהבים מספרים. דנה אוהבת מספרים. מה נכון בהכרח?",
    options: [
      "דנה כלכלנית",
      "דנה לא כלכלנית",
      "אי אפשר לדעת אם דנה כלכלנית",
      "אף כלכלן לא אוהב את דנה",
    ], correct: 2,
  },
  {
    id: "q5", domain: "verbal",
    text: "איזו מילה יוצאת דופן?",
    options: ["כינור", "חצוצרה", "מקרר", "פסנתר"], correct: 2,
  },
  {
    id: "q6", domain: "num",
    text: "מחיר של מוצר עלה ב-20% ואז ירד ב-20%. המחיר עכשיו:",
    options: [
      "זהה למחיר המקורי",
      "נמוך ב-4% מהמקורי",
      "גבוה ב-4% מהמקורי",
      "נמוך ב-2% מהמקורי",
    ], correct: 1,
  },
  {
    id: "q7", domain: "verbal",
    text: "ספר : פרק — כמו — שיר : ?",
    options: ["מנגינה", "בית", "זמר", "מילים"], correct: 1,
  },
  {
    id: "q8", domain: "logic",
    text: "המשך את הסדרה: 1, 1, 2, 3, 5, 8, ...",
    options: ["11", "12", "13", "15"], correct: 2,
  },
];

export const COGNITIVE_DOMAINS = { num: "חשיבה כמותית", verbal: "חשיבה מילולית", logic: "חשיבה לוגית" };

// ── Cognitive BONUS round — adaptive top-end discrimination ──
// Shown only to users who score ≥ COGNITIVE_ADVANCED_THRESHOLD on the base 8
// (weaker performers never see it, so the stage stays short and non-tiring;
// strong performers get a real ceiling test that separates "solid" from
// "engineer-grade" reasoning).
export const COGNITIVE_ADVANCED_THRESHOLD = 6;
export const COGNITIVE_ADVANCED = [
  {
    id: "a1", domain: "num",
    text: "אם 5 מכונות מייצרות 5 חלקים ב-5 דקות — כמה דקות ייקח ל-100 מכונות לייצר 100 חלקים?",
    options: ["100 דקות", "5 דקות", "20 דקות", "דקה אחת"], correct: 1,
  },
  {
    id: "a2", domain: "logic",
    text: "בקופסה 3 כדורים אדומים ו-3 כחולים. מוציאים 2 באקראי. מה הסיכוי ששניהם באותו צבע?",
    options: ["1/2", "2/5", "1/3", "3/5"], correct: 1,
  },
  {
    id: "a3", domain: "verbal",
    text: "זרע : עץ — כמו — טיוטה : ?",
    options: ["עיפרון", "ספר", "מחברת", "סופר"], correct: 1,
  },
  {
    id: "a4", domain: "num",
    text: "המשך את הסדרה: 2, 3, 5, 7, 11, 13, ...",
    options: ["15", "16", "17", "19"], correct: 2,
  },
  {
    id: "a5", domain: "logic",
    text: "בכפר מסוים כל תושב או תמיד משקר או תמיד דובר אמת. פוגשים אדם שאומר: \"אני שקרן\". מה נכון בהכרח?",
    options: ["הוא שקרן", "הוא דובר אמת", "הוא לא תושב הכפר", "אי אפשר לדעת"], correct: 2,
  },
  {
    id: "a6", domain: "num",
    text: "שעון מחוגים מראה 3:15 בדיוק. מה הזווית בין מחוג השעות למחוג הדקות?",
    options: ["0°", "7.5°", "12.5°", "30°"], correct: 1,
  },
];

// ── "Reality check" scenarios — adaptive, zero-AI-cost personalization ──
// The stage shows 6 concrete day-in-the-life scenarios chosen from the user's
// TOP-3 Holland letters (2 per letter — see scenarioItems in scoring.js), so
// every user rates a different, personally-relevant set. Gut reactions to a
// concrete day beat abstract interest ratings — and give the AI a "does the
// fantasy survive contact with reality" signal per emerging direction.
export const SCENARIO_SCALE = ["ממש לא", "לא ממש", "אולי", "נשמע טוב", "זה אני!"];

export const SCENARIOS_BY_TYPE = {
  R: [
    { id: "scR1", text: "אתה מגיע בבוקר למוסך / אתר / מעבדה, מקבל תקלה שאף אחד לא הצליח לפצח, ומבלה את היום עם הידיים בתוך המערכת — עד שהיא עובדת" },
    { id: "scR2", text: "רוב היום שלך עובר על הרגליים — בשטח, עם ציוד וכלים, מעט מאוד ישיבה מול מסך" },
  ],
  I: [
    { id: "scI1", text: "בוקר של צלילה בנתונים או במחקר: אתה בונה השערה, בודק, טועה, מתקן — ובסוף היום מבין משהו שאף אחד סביבך עוד לא הבין" },
    { id: "scI2", text: "העבודה שלך נמדדת בעומק, לא בקצב: שבועות על בעיה אחת מסובכת, בלי תוצאה מיידית ובלי מחיאות כפיים" },
  ],
  A: [
    { id: "scA1", text: "היום מתחיל בדף ריק: אתה יוצר משהו חדש — עיצוב, טקסט, סרטון — ובסופו מציג אותו לאנשים שמגיבים אליו" },
    { id: "scA2", text: "אין לך שגרה קבועה: כל פרויקט נראה אחרת, והסגנון האישי שלך הוא בעצם המוצר" },
  ],
  S: [
    { id: "scS1", text: "היום שלך בנוי מפגישות אחד-על-אחד: אנשים מגיעים אליך עם קושי אמיתי — ויוצאים ממך עם כיוון" },
    { id: "scS2", text: "אתה עומד מול קבוצה — מלמד, מדריך, מלווה — וההצלחה שלך נמדדת בהצלחה שלהם" },
  ],
  E: [
    { id: "scE1", text: "אתה פותח את הבוקר עם יעדים: שיחות, משא ומתן, החלטות מהירות — ובערב יודע בדיוק אם ניצחת היום" },
    { id: "scE2", text: "אתה מוביל צוות קטן: מגייס, מלהיב, סוגר פינות — והאחריות על התוצאה כולה עליך" },
  ],
  C: [
    { id: "scC1", text: "אתה מקבל תהליך מבולגן והופך אותו למערכת מסודרת: טבלאות, נהלים, בקרה — והכול מתחיל לעבוד חלק" },
    { id: "scC2", text: "עבודה מדויקת עם כללים ברורים: אתה זה שמוודא שלא נופלות טעויות — והדיוק שלך הוא הערך" },
  ],
};

// ── Open reflective questions — 5 ──
export const OPEN_QUESTIONS = [
  {
    id: "flow",
    text: "ספר על פעם שבה איבדת תחושת זמן כי היית שקוע לגמרי במשהו. מה עשית שם בדיוק?",
    hint: "זה יכול להיות כל דבר — משחק, פרויקט, שיחה, בנייה של משהו…",
  },
  {
    id: "help",
    text: "במה אנשים באים לבקש ממך עזרה — שוב ושוב?",
    hint: "מה שאחרים רואים בך זה רמז ענק למה שאתה טוב בו באמת.",
  },
  {
    id: "dream",
    text: "אם כסף לא היה שיקול בכלל — איך היה נראה יום עבודה מושלם שלך בעוד 5 שנים?",
    hint: "מאיפה אתה עובד? עם מי? על מה? מה עשית בסוף היום?",
  },
  {
    id: "fear",
    text: "מה הכי מפחיד אותך בבחירת דרך? ממה אתה חושש שתתחרט?",
    hint: "הפחדים שלנו מסמנים בדיוק את מה שחשוב לנו.",
  },
  {
    id: "envy",
    text: "על מה אתה מקנא באנשים אחרים? במי, ולמה דווקא בהם?",
    hint: "קנאה היא חץ שמצביע על רצון אמיתי שעוד לא הודית בו.",
  },
];

// ── Background form config ──
export const SITUATION_OPTIONS = [
  "לפני צבא / שירות לאומי",
  "במהלך השירות",
  "אחרי שחרור",
  "אחרי טיול / חו\"ל",
  "סטודנט (ולא בטוח שזה זה)",
  "עובד (ולא מרוצה)",
  "בין לבין — מחפש כיוון",
];

export const EDUCATION_OPTIONS = [
  "בגרות מלאה",
  "בגרות חלקית",
  "פסיכומטרי — עשיתי",
  "תעודה מקצועית",
  "תואר (או בתהליך)",
  "קורסים / לימוד עצמי",
];

export const CONSTRAINT_OPTIONS = [
  "צריך להתפרנס כבר עכשיו",
  "מגבלה כלכלית ללימודים",
  "מחויבות למשפחה",
  "קשור למקום מגורים",
  "אין מגבלות מיוחדות",
];
