import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { sanitizeBookletHtml } from "../lib/sanitize";
import Preview from "./Preview";
import { track } from "../hooks/useEvents";
import { IS_INAPP, openExternal } from "../lib/inapp";

// ── Curriculum map (מפמ"ר) ───────────────────────────────────────────────────
const CURRICULUM = {
  "הלכה": {
    "א": ["ברכות הנהנין (שהכל, העץ, האדמה)", "תפילת שחרית — ברכות השחר", "שבת — מצוות עשה ולא תעשה", "קידוש והבדלה"],
    "ב": ["ברכות המצוות", "שבת — מלאכות בסיסיות", "תפילה — ק\"ש ושמ\"ע", "שבת — הכנות ומצוות"],
    "ג": ["ל\"ט מלאכות שבת — מבוא ומיון", "ברכת המזון", "צדקה — 8 מדרגות הרמב\"ם", "שבת — מלאכות דרבנן"],
    "ד": ["ל\"ט מלאכות שבת — בפירוט", "תענית ציבור — הגדרות והלכות", "ט' באב — הלכות ומנהגים", "י\"ז בתמוז — הלכות"],
    "ה": ["ברכות — קדימויות וכללים", "גזל ואונאה", "לשון הרע — הגדרות ואיסורים", "בין אדם לחברו — כללי"],
    "ו": ["כשרות — בשר בחלב", "כשרות — שחיטה ותולעים", "הלכות פסח", "חגים — הלכות ומנהגים (ראה\"ש, יוה\"כ, סוכות)"],
    "ז": ["תפילה — מקור חיים פרק א (חיוב תפילה)", "תפילה — מקור חיים פרק ב (זמנים)", "תפילה — מקור חיים פרק ג (כוונה)", "תפילה — מקור חיים פרקים ד-ה (מניין, הפסקות)"],
    "ח": ["שבת — מקור חיים (מלאכות מדאורייתא)", "שבת — מקור חיים (מלאכות מדרבנן)", "שבת — מקור חיים (מוקצה)", "שבת — מקור חיים (חולה בשבת)"],
    "ט": ["ברכות — מקור חיים (ברכת הנהנין)", "ברכות — מקור חיים (ברכות אחרונות)", "בין אדם לחברו — מקור חיים (כבוד הבריות)", "בין אדם לחברו — מקור חיים (צדקה)"],
  },
  "משנה": {
    "ג": ["מבוא למשנה ורבי יהודה הנשיא", "מסכת אבות פרק א", "מסכת ברכות א:א", "מסכת פאה א:א"],
    "ד": ["מסכת תענית פרק א (שאלת גשמים)", "מסכת תענית פרק ב (תעניות ציבור)", "מסכת תענית פרק ג (מעשי חסידים)", "מסכת תענית פרק ד (ט\"ב)"],
    "ה": ["מסכת ראש השנה פרק א (ד' ראשי שנים)", "מסכת ראש השנה פרק ב (קידוש החודש)", "מסכת ראש השנה פרק ג (תקיעת שופר)", "מסכת ראש השנה פרק ד (תקנות רבן יוחנן)"],
    "ו": ["מסכת ברכות פרק א (ק\"ש)", "מסכת ברכות פרק ב (פטורים)", "מסכת ברכות פרק ג (אבל ואחרים)", "מסכת ברכות חזרה כוללת"],
    "ז": ["מסכת אבות פרקים א-ב", "מסכת אבות פרקים ג-ד", "מסכת אבות פרקים ה-ו", "מסכת אבות — שלמה וחזרה"],
    "ח": ["מסכת שבת פרק א (יציאות השבת)", "מסכת שבת פרק ב (הדלקת הנר)", "מסכת שבת פרק ז (ל\"ט מלאכות)", "חזרה על מסכת שבת"],
    "ט": ["מסכת בבא מציעא פרק א (מציאה)", "מסכת בבא מציעא פרק ב (השבת אבידה)", "חזרה על כל המסכתות", "מבחן כוללת — משנה"],
  },
  "תנ\"ך": {
    "א": ["בריאת העולם (בראשית א)", "גן עדן וחטא האדם", "קין והבל", "נח והמבול", "מגדל בבל"],
    "ב": ["אברהם — עקידת יצחק", "אברהם — ברית בין הבתרים", "יעקב ועשו — הברכות", "יעקב — חלום הסולם", "יוסף ואחיו"],
    "ג": ["גלות מצרים ועשר המכות", "קריעת ים סוף (בשלח)", "מעמד הר סיני (יתרו)", "עשרת הדיברות", "לוחות הברית ושבירתן"],
    "ד": ["ויקרא — קדושים (ואהבת לרעך)", "חטא המרגלים (שלח)", "קרח ועדתו", "בלעם ובלק", "מות משה"],
    "ה": ["דברים — ואתחנן (שמע ישראל)", "יהושע — כיבוש יריחו", "יהושע — חלוקת הארץ", "ברית שכם (יהושע כד)", "עי וגבעונים"],
    "ו": ["דבורה וברק (שופטים ד-ה)", "גדעון (שופטים ו-ח)", "שמשון (שופטים יג-טז)", "שמואל ושאול", "דוד וגלית"],
    "ז": ["דוד — ירושלים בירת ישראל", "חטא בת שבע ותוצאותיו", "שלמה ובנין בית המקדש", "אליהו הנביא — כרמל (מלכים א יח)", "מרד אבשלום"],
    "ח": ["גלות שמרון — חזקיהו", "יאשיהו ותיקוניו (מלכים ב כב)", "ירמיהו — חורבן (ירמיהו א, ז)", "תהילים — פרק כג עם רש\"י", "משלי פרקים א-ב"],
    "ט": ["יחזקאל — חזון המרכבה (יחזקאל א)", "יחזקאל — האחריות האישית (יחזקאל יח)", "מגילת אסתר — שלמה", "עזרא ונחמיה — שיבת ציון", "דניאל (פרקים א-ו)"],
  },
  "מקור חיים": {
    "ז": ["שער התפילה פרק א — מהות ומחויבות", "שער התפילה פרק ב — זמני תפילה", "שער התפילה פרק ג — כוונה ודעת", "שער התפילה פרקים ד-ה — מניין והפסקות"],
    "ח": ["שער השבת פרקים א-ב — קדושת שבת", "שער השבת פרקים ג-ד — מלאכות", "שער השבת פרקים ה-ו — עירוב ושינוי", "שער השבת פרקים ז-ח — מוקצה וחולה"],
    "ט": ["שער הברכות פרקים א-ב — ברכת הנהנין", "שער הברכות פרקים ג-ד — קדימויות וספק", "שער בין אדם לחברו פרקים א-ב", "שער בין אדם לחברו פרקים ג-ד — גזל ולשון הרע"],
  },
  "פרשת השבוע": {
    "א": ["פרשת בראשית — בריאת העולם", "פרשת נח — המבול ומגדל בבל", "פרשת לך לך — אברהם", "פרשה נוכחית + רש\"י"],
    "ב": ["פרשת חיי שרה — אברהם ויצחק", "פרשת ויצא — יעקב ורחל", "פרשת וישב — יוסף", "פרשה נוכחית + עיון"],
    "ג": ["פרשת שמות — לידת משה", "פרשת בשלח — קריעת ים סוף", "פרשת יתרו — מעמד הר סיני", "פרשה נוכחית + רש\"י"],
    "ד": ["פרשת קדושים — מצוות בין אדם לחברו", "פרשת שלח — חטא המרגלים", "פרשת בלק — בלעם", "פרשה נוכחית + דיון ערכי"],
    "ה": ["פרשת ואתחנן — שמע ישראל", "פרשת עקב — מצוות ופרסים", "פרשה נוכחית + רש\"י ורמב\"ן", "פרשה נוכחית — ניתוח מעמיק"],
    "ו": ["פרשה נוכחית — ספר שמואל", "פרשה נוכחית — ספר שופטים", "פרשה נוכחית + פרשנות מגוונת", "פרשה נוכחית — ניתוח ודיון"],
    "ז": ["פרשה נוכחית + רש\"י ורמב\"ן", "פרשה נוכחית — ספר מלכים", "פרשה נוכחית — ספר ישעיהו", "פרשה נוכחית — ניתוח ויישום"],
    "ח": ["פרשה נוכחית עם פרשנים", "פרשה נוכחית — ספר ירמיהו", "פרשה נוכחית — תהילים ומשלי", "פרשה נוכחית — השוואה בין פרשנים"],
    "ט": ["פרשה נוכחית + פרשנים מגוונים", "פרשה נוכחית — נביאים אחרונים", "פרשה נוכחית — כתובים", "פרשה נוכחית — ניתוח עמוק ויצירה"],
  },
  "מחשבת ישראל": {
    "ז": ["אמונה ובחירה חופשית — רמב\"ם", "שאלת הרע והאמונה", "עולם הבא ועולם הזה", "תשובה — מהות ותהליך"],
    "ח": ["תורה שבעל פה — מקורה ומסירתה", "שלשלת הקבלה (אבות פרק א)", "בין פרשנות לפסיקה הלכתית", "ייחוד ישראל ותפקידם"],
    "ט": ["ציונות דתית — הרב קוק", "הרב סולוביצ'יק — האיש האמוני", "מדינת ישראל ואמונה", "פסיקה הלכתית בזמננו"],
  },
  "גמרא": {
    "ז": ["מבוא לגמרא — מבנה הדף ומונחי יסוד", "בבא מציעא — \"אלו מציאות\" (השבת אבידה)", "סימנים וייאוש בעלים", "מונחי משא ומתן: קושיא, תירוץ, תא שמע"],
    "ח": ["בבא מציעא — \"אלו מציאות\" (מצא בחנות/בכותל)", "דיני שומרים — שומר חינם ושומר שכר (מבוא)", "מסכת ברכות — סוגיה נבחרת", "מיומנות: זיהוי מבנה הסוגיה"],
    "ט": ["בבא מציעא — \"השוכר את הפועלים\" (מבוא)", "דיני ממונות — הלוואה וריבית", "מסכת סנהדרין/מכות — סוגיה נבחרת", "חזרה ומיומנויות לימוד עצמאי"],
  },
  "תפילה": {
    "א": ["ברכות השחר — מודה אני ונטילת ידיים", "מבנה תפילת שחרית", "כוונה בתפילה — לדבר אל ה'", "ברכות הנהנין"],
    "ב": ["ברכות קריאת שמע", "פסוקי דזמרה — מבוא", "אשרי (תהילים קמ\"ה)", "קריאת שמע — פרשה ראשונה"],
    "ג": ["שמונה עשרה — שלוש ברכות ראשונות", "ברכות אמצעיות — בקשות", "מודים — הודאה", "סדר תפילת שחרית השלם"],
    "ד": ["קריאת שמע — שלוש הפרשות", "ברכות ק\"ש (יוצר אור, אהבה רבה)", "תפילת מנחה וערבית", "הלל — מתי אומרים"],
    "ה": ["שמונה עשרה — פירוש הברכות", "תחנון ונפילת אפיים", "קריאת התורה בתפילה", "תפילה בציבור ומניין"],
    "ו": ["סדר התפילה — ניתוח מעמיק", "פיוטים ותוספות לתפילה", "תפילות החגים — מבוא", "כוונה ומשמעות — עיון"],
    "ז": ["מקורות חיוב התפילה (תושב\"ע)", "תפילה כעבודה שבלב", "ברכות השחר — מקורות ומשמעות", "מבנה התפילה לעומק"],
    "ח": ["תפילות מועדים — מבנה ושינויים", "מוסף — מתי ולמה", "נוסחי תפילה (אשכנז, ספרד, עדות)", "תפילה וכוונה — עיון הלכתי"],
    "ט": ["הלכות תפילה — זמנים ודינים", "תפילת הדרך וברכות מיוחדות", "בית הכנסת — קדושתו ודיניו", "תפילה במחשבת ישראל"],
  },
  "מועדים וחגים": {
    "א": ["ראש השנה — מלך ושופר", "יום כיפור — סליחה וצום", "סוכות — סוכה וארבעת המינים", "חנוכה — נס פך השמן", "פורים — מגילה ומשלוח מנות", "פסח — יציאת מצרים"],
    "ב": ["ראש השנה — סימני השנה ותקיעות", "סוכות — שמחת בית השואבה", "חנוכה — הדלקת נרות והלכות", "ט\"ו בשבט — ראש השנה לאילן", "פורים — ארבע מצוות היום", "פסח — סדר ההגדה"],
    "ג": ["עשרת ימי תשובה", "סוכות — מצוות הסוכה", "חנוכה — מהמכבים עד היום", "פורים — סיפור המגילה", "פסח — חמץ ומצה", "שבועות — מתן תורה"],
    "ד": ["ראש השנה ויום כיפור — עבודת היום", "שמיני עצרת ושמחת תורה", "תעניות — עשרה בטבת ותשעה באב", "פורים — הלכות ומנהגים", "ספירת העומר ול\"ג בעומר", "שבועות — מנהגי החג"],
    "ה": ["מועדי תשרי — מבט כולל", "חנוכה ופורים — מדרבנן", "ארבע פרשיות וחודש אדר", "פסח — ליל הסדר וההגדה", "ימי בין המצרים ותשעה באב", "שלוש רגלים — משמעות"],
    "ו": ["לוח השנה העברי — חודשים ועיבור", "מועדי תשרי — הלכה ומחשבה", "חנוכה — על הניסים ומשמעות", "פסח — ביעור חמץ והגדה", "ספירת העומר ושבועות", "יום העצמאות ויום ירושלים"],
  },
};

const SUBJECTS = [
  { id: "הלכה",           icon: "⚖️",  label: "הלכה",           desc: "שבת, ברכות, כשרות, מועדים" },
  { id: "תפילה",          icon: "🙏",  label: "תפילה",          desc: "נוסח, ברכות, כוונה — א-ט" },
  { id: "משנה",           icon: "📜",  label: "משנה",           desc: "מסכתות לפי כיתה" },
  { id: "גמרא",           icon: "📚",  label: "גמרא",           desc: "סוגיות ומסכתות — ז-ט" },
  { id: "תנ\"ך",          icon: "📖",  label: "תנ\"ך",           desc: "חמ\"ד — בראשית עד כתובים" },
  { id: "פרשת השבוע",    icon: "✡️",  label: "פרשת השבוע",    desc: "הפרשה השוטפת + פרשנים" },
  { id: "מועדים וחגים",  icon: "🕎",  label: "מועדים וחגים",  desc: "מעגל השנה — כל החגים" },
  { id: "מחשבת ישראל",   icon: "🔯",  label: "מחשבת ישראל",   desc: "אמונה, ציונות דתית (ז-ט)" },
  { id: "מקור חיים",      icon: "🕍",  label: "מקור חיים",      desc: "הרב חיים דוד הלוי (ז-ט)" },
];

const GRADES = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

const OUTPUT_TYPES = [
  { id: "דף_עבודה",    icon: "📄", label: "דף עבודה",       desc: "תרגילים ושאלות עם מקום לכתיבה" },
  { id: "שאלות_הבנה",  icon: "💬", label: "שאלות הבנה",     desc: "שאלות על טקסט מקור מצוטט" },
  { id: "סיכום",        icon: "📋", label: "סיכום שיעור",    desc: "סיכום מובנה עם מונחים ומקורות" },
  { id: "מבחן",         icon: "📝", label: "מבחן",           desc: "100 נקודות — סגורות + פתוחות" },
  { id: "כרטיסיות",     icon: "🃏", label: "כרטיסיות חזרה", desc: "הדפסה-וגזירה — שאלה/תשובה" },
  { id: "מפת_מושגים",  icon: "🗺️", label: "מפת מושגים",    desc: "מבנה ויזואלי חסר למילוי" },
];

const LEVELS = [
  { id: "basic",    label: "קל",    desc: "כיתות נמוכות / מתקשים" },
  { id: "medium",   label: "בינוני", desc: "רמה כיתתית רגילה" },
  { id: "advanced", label: "מאתגר", desc: "מצטיינים / כיתות גבוהות" },
];

const LOADING_MSGS = [
  "יוצר חומרי לימוד... ✍️",
  "מגיש מקורות מהמפמ\"ר...",
  "מנסח שאלות ברמות חשיבה...",
  "מציטט פסוקים ומשניות...",
  "מעצב עמודים מוכנים להדפסה...",
  "מדייק לפי תכנית הלימודים...",
  "כמעט מוכן! עוד רגע...",
];

// Live build-preview constants — same A4 dims as Preview.jsx; display only.
const A4_PX = 794;
const A4_H  = 1123;
const countPages = (html) => (html.match(/296mm/g) || []).length;

export default function JewishCreate({ onSaved, remaining, isPro, bookletCount = 0, onUpgrade }) {
  const [subject, setSubject] = useState("הלכה");
  const [grade,   setGrade]   = useState("ה");
  const [topic,   setTopic]   = useState(CURRICULUM["הלכה"]?.["ה"]?.[0] ?? "");
  const [customTopic, setCustomTopic] = useState("");
  const [outputType, setOutputType]   = useState("דף_עבודה");
  const [level,   setLevel]   = useState("medium");
  const [notes,   setNotes]   = useState("");
  const [pageCount, setPageCount] = useState(2);
  const [fastMode, setFastMode]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [streamChars, setStreamChars] = useState(0);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [html,    setHtml]    = useState(null);
  const [error,   setError]   = useState(null);
  const [rateCountdown, setRateCountdown] = useState(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [bookletId, setBookletId]   = useState(null);
  const [bookletTitle, setBookletTitle] = useState(null);

  // In-app browsers get a server-side 3-page cap — warn BEFORE generating so a
  // 4+ page request doesn't silently burn quota on a 3-page result (same guard
  // as Create.jsx).
  const [inappCapWarn, setInappCapWarn] = useState(false);
  const inappCapAckRef = useRef(false);
  const streamAbortRef = useRef(null);
  const creatingRef    = useRef(false);
  const retryCountRef  = useRef(0);
  const retryTimerRef  = useRef(null);
  const createRef      = useRef(null);

  const availableGrades = CURRICULUM[subject] ? Object.keys(CURRICULUM[subject]) : GRADES;
  const suggestedTopics = (CURRICULUM[subject]?.[grade] ?? []);

  useEffect(() => {
    setTopic(CURRICULUM[subject]?.[grade]?.[0] ?? "");
    setCustomTopic("");
  }, [subject, grade]);

  useEffect(() => {
    if (!loading) { setLoadingMsgIdx(0); setStreamChars(0); setLoadingElapsed(0); setPreviewHtml(""); return; }
    const msgId = setInterval(() => setLoadingMsgIdx(i => (i + 1) % LOADING_MSGS.length), 3500);
    const secId = setInterval(() => setLoadingElapsed(s => s + 1), 1000);
    return () => { clearInterval(msgId); clearInterval(secId); };
  }, [loading]);

  useEffect(() => () => {
    streamAbortRef.current?.abort();
    clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    const match = error?.match(/^rate:(\d+)$/);
    setRateCountdown(match ? parseInt(match[1]) : null);
  }, [error]);

  useEffect(() => {
    if (!rateCountdown || rateCountdown <= 0) {
      if (rateCountdown === 0) setError(null);
      return;
    }
    const t = setTimeout(() => setRateCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [rateCountdown]);

  const effectiveTopic = topic === "__custom__" ? customTopic.trim() : topic;
  const canSubmit = !loading && subject && grade && effectiveTopic.length > 2;

  // isAutoRetry: strict-true only from the auto-retry timers — onClick passes
  // a SyntheticEvent, which must NOT read as a retry.
  const create = useCallback(async (isAutoRetry = false) => {
    if (!canSubmit || creatingRef.current) return;
    if (IS_INAPP && pageCount > 3 && !inappCapAckRef.current) {
      setInappCapWarn(true);
      track("inapp_cap_warning_shown", { mode: "jewish", pageCount });
      return;
    }
    setInappCapWarn(false);
    if (isAutoRetry !== true) retryCountRef.current = 0; // manual click = fresh retry budget + honest analytics
    creatingRef.current = true;
    setLoading(true);
    setHtml(null);
    setPreviewHtml("");
    setError(null);
    setSaveWarning(false);
    // booklet_started/booklet_error are what the admin reliability panel counts —
    // without them the entire Jewish product was invisible to monitoring.
    track("booklet_started", { mode: "jewish", subject, grade, outputType, pageCount, retry: isAutoRetry === true });

    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) {
      setLoading(false);
      creatingRef.current = false;
      setError("generic:אתה לא מחובר — נסה להתחבר מחדש");
      return;
    }

    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;

    const useNoStream = IS_INAPP;
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL ?? "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/generate-jewish`;
    let resp;
    try {
      resp = await fetch(fnUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ subject, grade, topic: effectiveTopic, outputType, level, notes, pageCount, noStream: useNoStream, fast: fastMode }),
      });
    } catch (e) {
      setLoading(false);
      creatingRef.current = false;
      if (ctrl.signal.aborted) return;
      track("jewish_error", { kind: "network", inapp: IS_INAPP, noStream: useNoStream, msg: String(e?.message ?? e).slice(0, 120) });
      setError(IS_INAPP
        ? "generic:כדי ליצור חומר, פתחי את הדף בדפדפן רגיל (Chrome/Safari) — לא מתוך אפליקציה כמו וואטסאפ/אינסטגרם 🙏"
        : `generic:שגיאת רשת — בדקי את החיבור ונסי שוב`);
      return;
    }

    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => "");
      let errData = {};
      try { errData = JSON.parse(rawBody); } catch {}
      const code = errData?.error;
      setLoading(false);
      creatingRef.current = false;
      track("jewish_error", { kind: "server", status: resp.status, code: code ?? null, inapp: useNoStream });
      if (code === "quota_exceeded") { const monthly = errData?.period === "monthly"; setError(monthly ? "quota_monthly" : "quota"); return; }
      if (code === "rate_limited") {
        const wait = errData?.wait ?? 60;
        if (retryCountRef.current > 0 && wait <= 60) {
          retryTimerRef.current = setTimeout(() => createRef.current?.(true), (wait + 1) * 1000);
          return;
        }
        setError(`rate:${wait}`); return;
      }
      if (code === "ai_overloaded") { setError("generic:השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"); return; }
      if (code === "ai_timeout")    { setError(useNoStream
        ? "generic:הייצור ארוך מדי לדפדפן של פייסבוק — פתחי בדפדפן (הכפתור למעלה) או בחרי פחות עמודים 🙏"
        : "generic:הייצור לקח יותר מדי זמן — נסי עם פחות עמודים"); return; }
      if (code === "ai_error")      { setError("generic:השרת נתקל בבעיה רגעית — נסי שוב 🙏"); return; }
      if (code === "internal_error"){ setError(useNoStream
        ? "generic:הייצור ארוך מדי לדפדפן של פייסבוק — פתחי בדפדפן (הכפתור למעלה) 🙏"
        : "generic:שגיאה זמנית בשרת — נסי שוב 🙏"); return; }
      if (resp.status === 401)      { setError("generic:הסשן פג תוקף — רענן את הדף"); return; }
      setError(`generic:שגיאת שרת ${resp.status} — נסי שוב 🙏`);
      return;
    }

    let htmlAccumulated = "";
    let streamHadError = false;
    let streamErrorMsg = null;
    let streamAborted = false;
    let stopReason = null;

    if (useNoStream) {
      try {
        const j = await resp.json();
        htmlAccumulated = j?.html ?? "";
      } catch (e) {
        if (ctrl.signal.aborted) { creatingRef.current = false; return; }
        setLoading(false); creatingRef.current = false;
        track("jewish_error", { kind: "nostream_parse", inapp: true, msg: String(e?.message ?? e).slice(0, 120) });
        setError("generic:לא הצלחנו לקבל את החומר — פתחי בדפדפן (הכפתור למעלה) ונסי שוב 🙏");
        return;
      }
    } else {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let updateTimer = 0;
    let previewTimer = 0;

    let wakeLock = null;
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {}

    const DEAD_CONN_MS     = 30000;
    const CONTENT_STALL_MS = 90000;
    let lastContentAt = Date.now();
    try {
      while (true) {
        const readResult = await Promise.race([
          reader.read(),
          new Promise((res) => setTimeout(() => res("__dead__"), DEAD_CONN_MS)),
        ]);
        if (readResult === "__dead__") throw new Error("dead_connection");
        const { done, value } = readResult;
        if (done) break;
        const beforeLen = htmlAccumulated.length;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
              htmlAccumulated += ev.delta.text;
              const now = Date.now();
              if (now - updateTimer > 100) { setStreamChars(htmlAccumulated.length); updateTimer = now; }
              if (now - previewTimer > 2000) { setPreviewHtml(htmlAccumulated); previewTimer = now; }
            } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
              stopReason = ev.delta.stop_reason;
            } else if (ev.type === "error") {
              streamHadError = true;
              streamErrorMsg = ev.error?.type === "overloaded_error"
                ? "generic:השרת עמוס כרגע — נסי שוב בעוד דקה 🙏"
                : `generic:שגיאת AI — ${ev.error?.type ?? "unknown"}`;
            }
          } catch {}
          if (streamHadError) break;
        }
        if (htmlAccumulated.length > beforeLen) lastContentAt = Date.now();
        else if (Date.now() - lastContentAt > CONTENT_STALL_MS) throw new Error("content_stalled");
        if (streamHadError) break;
      }
    } catch (streamErr) {
      if (ctrl.signal.aborted) { creatingRef.current = false; return; }
      // Kill the zombie connection — a stalled stream left open keeps the server-side
      // generation running (double API cost) and contends with the per-user rate limit.
      ctrl.abort();
      const partial = htmlAccumulated.trim();
      if (partial.length > 6000 && (partial.includes("<!DOCTYPE") || partial.includes("<html"))) {
        if (!partial.includes("</html>")) htmlAccumulated = partial + "\n</body></html>";
        streamAborted = true;
      } else if (retryCountRef.current < 1) {
        retryCountRef.current++;
        setStreamChars(0); setLoadingElapsed(0); setLoadingMsgIdx(0);
        creatingRef.current = false;
        setLoading(false);
        retryTimerRef.current = setTimeout(() => createRef.current?.(true), 2000);
        return;
      } else {
        retryCountRef.current = 0;
        setLoading(false);
        creatingRef.current = false;
        track("booklet_error", { type: "stream_dropped", mode: "jewish" });
        setError(`generic:החיבור נקטע — לחצי שוב על "צור חומר" כדי לנסות שוב`);
        return;
      }
    } finally {
      wakeLock?.release().catch(() => {});
    }
    }

    setLoading(false);
    creatingRef.current = false;
    // Successful stream — restore the auto-retry budget for the next generation.
    retryCountRef.current = 0;
    if (streamHadError) { track("booklet_error", { type: "stream_error", mode: "jewish" }); setError(streamErrorMsg); return; }

    // Token-budget truncation ends the stream "normally" but the material is
    // incomplete — close the tags and mark it partial (saveWarning shows).
    if (stopReason === "max_tokens") {
      streamAborted = true;
      const t = htmlAccumulated.trim();
      if (!t.includes("</html>")) htmlAccumulated = t + "\n</body></html>";
    }

    const generatedHtml = sanitizeBookletHtml(htmlAccumulated.trim());
    if (!generatedHtml || !generatedHtml.includes("<")) { track("booklet_error", { type: "empty_html", mode: "jewish" }); setError("generic:לא התקבל HTML תקין מהשרת"); return; }

    const outputLabel = OUTPUT_TYPES.find(o => o.id === outputType)?.label ?? outputType;
    const title = `${subject} כיתה ${grade} — ${effectiveTopic.substring(0, 50)}${streamAborted ? " (חלקי)" : ""} (${outputLabel})`;

    setBookletTitle(title);
    // Retry the save once on a transient failure — a ~90s generation shouldn't be
    // lost to a momentary network/DB blip (mirrors Create.jsx).
    let inserted = null, insertErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await supabase.from("booklets").insert({
        user_id: session.user.id,
        title,
        goal: effectiveTopic.substring(0, 200),
        world: subject,
        level,
        html: generatedHtml,
      }).select("id, share_token").single();
      inserted = res.data; insertErr = res.error;
      // Quota-trigger rejection is permanent — retrying it just wastes 1.2s.
      if (!insertErr || insertErr.message?.includes("quota_exceeded")) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    }

    // ALWAYS show the finished booklet — even when the DB quota trigger rejected
    // the save (race window): the user watched a ~90s generation succeed and must
    // be able to print it. The save warning below covers the "not in cloud" part.
    setHtml(generatedHtml);
    if (insertErr?.message?.includes("quota_exceeded")) {
      track("jewish_error", { kind: "quota_db" });
      setSaveWarning(true);
      onSaved?.();
      return;
    }

    if (insertErr) {
      setSaveWarning(true);
      track("jewish_save_failed", { message: insertErr.message });
    } else {
      setBookletId(inserted?.id ?? null);
      setShareToken(inserted?.share_token ?? null);
      if (streamAborted) setSaveWarning(true);
    }

    track("jewish_completed", { subject, grade, topic: effectiveTopic, outputType, level, pageCount, pagesDelivered: countPages(htmlAccumulated), booklet_index: bookletCount + 1 });
    onSaved?.();
  }, [canSubmit, subject, grade, effectiveTopic, outputType, level, notes, pageCount, onSaved, fastMode, bookletCount]);

  createRef.current = create;

  if (html) {
    return (
      <div>
        {saveWarning && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center">
            ⚠️ החומר נוצר בהצלחה אך לא נשמר בענן — הדפיסו עכשיו לפני שסוגרים
          </div>
        )}
        <Preview
          html={html}
          shareToken={shareToken}
          bookletId={bookletId}
          title={bookletTitle}
          context="jewish"
          onReset={() => { setHtml(null); setSaveWarning(false); setError(null); setShareToken(null); setBookletId(null); setBookletTitle(null); }}
        />
      </div>
    );
  }

  return (
    // pb-28 on mobile: the sticky CTA (fixed bottom-16) otherwise permanently
    // covers the last form controls — they can never scroll clear of it.
    <div className="space-y-5 pb-28 lg:pb-0">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">✡️</span>
        <div>
          <h2 className="font-bold text-ink text-lg font-display">חומרי יהדות — מפמ"ר</h2>
          <p className="text-xs text-ink/50 mt-0.5">דפי עבודה, מבחנים וסיכומים לפי תכנית הלימודים הרשמית</p>
        </div>
      </div>

      {/* Subject picker */}
      <div>
        <label className="block text-xs font-semibold text-ink/60 mb-2">מקצוע</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUBJECTS.map(s => (
            <button
              key={s.id}
              onClick={() => {
                const newGrades = CURRICULUM[s.id] ? Object.keys(CURRICULUM[s.id]) : GRADES;
                setSubject(s.id);
                if (!newGrades.includes(grade)) setGrade(newGrades[0]);
              }}
              className={`flex items-start gap-2 p-3 rounded-xl border text-right transition-all ${
                subject === s.id
                  ? "border-magic bg-magic/8 shadow-sm"
                  : "border-ink/10 bg-white hover:border-ink/25"
              }`}
            >
              <span className="text-xl flex-shrink-0">{s.icon}</span>
              <div>
                <p className={`text-xs font-semibold ${subject === s.id ? "text-magic" : "text-ink"}`}>{s.label}</p>
                <p className="text-[10px] text-ink/40 leading-tight mt-0.5">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Grade picker */}
      <div>
        <label className="block text-xs font-semibold text-ink/60 mb-2">כיתה</label>
        <div className="flex flex-wrap gap-2">
          {availableGrades.map(g => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all border ${
                grade === g
                  ? "bg-magic text-white border-magic shadow-sm"
                  : "bg-white border-ink/15 text-ink/60 hover:border-ink/30"
              }`}
            >
              {g}
            </button>
          ))}
          {!availableGrades.includes(grade) && (
            <button
              onClick={() => setGrade(availableGrades[0])}
              className="text-xs text-ink/40 px-3 py-2 rounded-xl border border-dashed border-ink/15 hover:border-ink/30"
            >
              בחר כיתה זמינה →
            </button>
          )}
        </div>
        {(subject === "מקור חיים" || subject === "מחשבת ישראל") && (
          <p className="text-[10px] text-ink/40 mt-1">מקצוע זה נלמד בכיתות ז–ט בלבד</p>
        )}
      </div>

      {/* Topic picker */}
      <div>
        <label className="block text-xs font-semibold text-ink/60 mb-2">נושא</label>
        {suggestedTopics.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {suggestedTopics.map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`text-right px-3 py-2 rounded-lg border text-xs transition-all ${
                    topic === t
                      ? "border-brand bg-brand/8 text-ink font-medium shadow-sm"
                      : "border-ink/10 bg-white text-ink/70 hover:border-ink/25"
                  }`}
                >
                  {t}
                </button>
              ))}
              <button
                onClick={() => setTopic("__custom__")}
                className={`text-right px-3 py-2 rounded-lg border text-xs transition-all ${
                  topic === "__custom__"
                    ? "border-brand bg-brand/8 text-ink font-medium"
                    : "border-dashed border-ink/15 text-ink/40 hover:border-ink/25"
                }`}
              >
                ✏️ נושא חופשי אחר...
              </button>
            </div>
            {topic === "__custom__" && (
              <input
                type="text"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder="הקלד/י נושא ספציפי..."
                className="w-full px-3 py-2 rounded-lg border border-ink/20 text-sm bg-white text-ink placeholder-ink/30 focus:outline-none focus:border-brand/50"
                autoFocus
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            placeholder="הקלד/י נושא ספציפי..."
            className="w-full px-3 py-2 rounded-lg border border-ink/20 text-sm bg-white text-ink placeholder-ink/30 focus:outline-none focus:border-brand/50"
          />
        )}
      </div>

      {/* Output type */}
      <div>
        <label className="block text-xs font-semibold text-ink/60 mb-2">סוג חומר</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OUTPUT_TYPES.map(o => (
            <button
              key={o.id}
              onClick={() => setOutputType(o.id)}
              className={`flex items-start gap-2 p-2.5 rounded-xl border text-right transition-all ${
                outputType === o.id
                  ? "border-brand bg-brand/8 shadow-sm"
                  : "border-ink/10 bg-white hover:border-ink/25"
              }`}
            >
              <span className="text-lg flex-shrink-0">{o.icon}</span>
              <div>
                <p className={`text-xs font-semibold leading-tight ${outputType === o.id ? "text-ink" : "text-ink/70"}`}>{o.label}</p>
                <p className="text-[10px] text-ink/40 leading-tight mt-0.5">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Level + Pages row */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-ink/60 mb-2">רמה</label>
          <div className="flex gap-1.5">
            {LEVELS.map(l => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                  level === l.id
                    ? "bg-grow text-white border-grow shadow-sm"
                    : "bg-white border-ink/15 text-ink/60 hover:border-ink/30"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold text-ink/60 mb-2">עמודים</label>
          <div className="flex gap-1.5">
            {(isPro ? [2, 3, 4, 5] : [1, 2]).map(n => (
              <button
                key={n}
                onClick={() => setPageCount(n)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                  pageCount === n
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-white border-ink/15 text-ink/60 hover:border-ink/30"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Optional notes */}
      <div>
        <label className="block text-xs font-semibold text-ink/60 mb-1.5">הוראות נוספות <span className="font-normal text-ink/30">(רשות)</span></label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="למשל: התמקד בפרק ב, כלול שאלות על רשי, רמת כיתה ה אתגרית..."
          className="w-full px-3 py-2 rounded-lg border border-ink/15 text-xs bg-white text-ink placeholder-ink/30 resize-none focus:outline-none focus:border-brand/50"
        />
      </div>

      {/* Error display */}
      {error && (
        <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${
          error === "quota" || error === "quota_monthly"
            ? "bg-amber-50 border border-amber-200 text-amber-800"
            : error.startsWith("rate:")
            ? "bg-blue-50 border border-blue-200 text-blue-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {error === "quota" && (
            <div className="space-y-2">
              <p className="font-semibold">השתמשת ב-{bookletCount} חוברות החינם שלך</p>
              <p className="text-xs">לשדרוג ויצירת חומרים ללא הגבלה:</p>
              <button onClick={onUpgrade} className="w-full py-2 bg-gradient-to-l from-brand to-magic text-white rounded-lg text-xs font-semibold">
                שדרגי לפרו ✨
              </button>
            </div>
          )}
          {error === "quota_monthly" && <p>הגעת למכסה החודשית — תתחדש בראש החודש הבא</p>}
          {error.startsWith("rate:") && rateCountdown !== null && (
            <p>ממתין לסיום ייצור קודם... עוד {rateCountdown} שניות</p>
          )}
          {error.startsWith("generic:") && <p>{error.slice(8)}</p>}
        </div>
      )}

      {loading && (
        <div className="bg-magic/5 border border-magic/15 rounded-2xl p-4 space-y-3" role="status" aria-live="polite">
          <p className="text-center font-display font-bold text-ink text-sm">
            ✡️ {LOADING_MSGS[loadingMsgIdx]}
          </p>
          <div className="w-full bg-white rounded-full h-2.5 overflow-hidden">
            {streamChars > 0
              ? <div className="h-full bg-gradient-to-l from-brand via-magic to-grow rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(97, (streamChars / (pageCount * 3200)) * 100)}%` }} />
              : <div className="h-full bg-gradient-to-l from-brand via-magic to-grow rounded-full animate-shimmer" />}
          </div>
          <div className="flex justify-between text-xs text-ink/35">
            <span>{streamChars > 0 ? `${streamChars.toLocaleString("he-IL")} תווים` : `${pageCount} עמודי A4`}</span>
            <span>⏱ {loadingElapsed}s</span>
          </div>
          <p className="text-center text-[11px] text-ink/50 leading-relaxed">
            💡 חומרים עם מקורות מדויקים מהמפמ"ר לוקחים קצת יותר זמן — שווה את ההמתנה
          </p>
        </div>
      )}

      {/* Speed vs depth toggle */}
      {!loading && (
      <button
        type="button"
        onClick={() => setFastMode(v => !v)}
        className={`w-full rounded-xl p-3 text-sm font-medium border transition-all flex items-center justify-between ${
          fastMode ? "border-brand bg-brand/8 text-ink" : "border-ink/15 bg-white text-ink/60"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{fastMode ? "⚡" : "📚"}</span>
          {fastMode ? "מצב מהיר — חומר קליל, מוכן הרבה יותר מהר" : "מצב מלא — חומר עשיר ומפורט (איטי יותר)"}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${fastMode ? "bg-brand text-white" : "bg-ink/10 text-ink/50"}`}>
          {fastMode ? "מהיר" : "מלא"}
        </span>
      </button>
      )}

      {/* Live build preview */}
      {loading && (previewHtml.includes("</style>") || previewHtml.includes("</head>")) && (
        <div className="space-y-2 mb-2">
          <div className="flex justify-center">
            <div
              dir="ltr"
              className="relative rounded-2xl overflow-hidden border border-ink/10 shadow-lg bg-white"
              style={{ width: 300, height: Math.round(A4_H * (300 / A4_PX)) }}
            >
              <iframe
                title="תצוגה חיה של החומר"
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                style={{
                  width: `${A4_PX}px`,
                  height: `${pageCount * A4_H}px`,
                  transform: `scale(${300 / A4_PX}) translateY(-${Math.max(0, Math.min(pageCount - 1, countPages(previewHtml) - 1)) * A4_H}px)`,
                  transformOrigin: "top left",
                  border: "none",
                  display: "block",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transition: "transform 0.7s ease",
                }}
              />
              <div className="absolute top-2 right-2 bg-magic/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> חי
              </div>
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            </div>
          </div>
          {pageCount > 1 && countPages(previewHtml) > 0 && (
            <p className="text-center text-xs text-ink/45">
              בונה עמוד {Math.min(pageCount, countPages(previewHtml))} מתוך {pageCount} ✍️
            </p>
          )}
        </div>
      )}

      {inappCapWarn && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 text-right space-y-3">
          <p className="font-bold text-amber-900 text-sm">📱 את/ה בדפדפן פנימי (וואטסאפ/אינסטגרם/פייסבוק)</p>
          <p className="text-xs text-amber-800">
            כאן אפשר ליצור עד 3 עמודים בלבד. חוברת של {pageCount} עמודים דורשת דפדפן רגיל (Chrome/Safari) — שנייה לפתוח, ואותה חוברת בדיוק.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => { track("inapp_cap_open_browser", { mode: "jewish", pageCount }); openExternal(window.location.href); }}
              className="flex-1 bg-magic text-white rounded-xl py-2.5 px-4 text-sm font-bold hover:opacity-90">
              🌐 פתחי בדפדפן רגיל — לחוברת המלאה
            </button>
            <button onClick={() => { inappCapAckRef.current = true; setInappCapWarn(false); track("inapp_cap_proceed_3", { mode: "jewish", pageCount }); create(); }}
              className="flex-1 bg-white border border-amber-300 text-amber-900 rounded-xl py-2.5 px-4 text-sm font-semibold hover:bg-amber-100">
              להמשיך כאן עם 3 עמודים
            </button>
          </div>
        </div>
      )}

      {/* Generate button — hidden on mobile when not loading (sticky CTA below covers that) */}
      <button
        onClick={create}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
          loading ? "" : "hidden lg:block"
        } ${
          canSubmit
            ? "bg-gradient-to-l from-magic to-brand text-white shadow-lg hover:opacity-90 active:scale-98"
            : "bg-ink/8 text-ink/25 cursor-not-allowed"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-ink/20 border-t-magic rounded-full animate-spin" />
            יוצר...
          </span>
        ) : (
          `✨ צור ${OUTPUT_TYPES.find(o => o.id === outputType)?.label ?? "חומר"}`
        )}
      </button>
      {!canSubmit && !loading && (
        <p className="text-center text-xs text-magic/70 mt-2 font-medium hidden lg:block">
          {!subject ? "👆 בחר/י מקצוע כדי להמשיך"
            : !grade ? "👆 בחר/י כיתה כדי להמשיך"
            : effectiveTopic.length <= 2 ? "👆 בחר/י נושא (או כתוב/כתבי נושא חופשי) כדי ליצור"
            : ""}
        </p>
      )}

      {/* Sticky mobile CTA — above the bottom tab bar, hidden during generation */}
      {!loading && !html && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 z-10 px-4 pb-2 pt-3 bg-gradient-to-t from-canvas/95 to-transparent pointer-events-none">
          <button
            onClick={create}
            disabled={!canSubmit}
            className={`w-full pointer-events-auto py-3.5 rounded-2xl font-bold text-sm transition-all ${
              canSubmit
                ? "bg-gradient-to-l from-magic to-brand text-white shadow-lg shadow-magic/20"
                : "bg-white/80 text-ink/30 border border-ink/10 cursor-not-allowed"
            }`}
          >
            {canSubmit
              ? `✨ צור ${OUTPUT_TYPES.find(o => o.id === outputType)?.label ?? "חומר"}`
              : !subject ? "בחר/י מקצוע תחילה"
              : !grade ? "בחר/י כיתה תחילה"
              : "בחר/י נושא תחילה"}
          </button>
        </div>
      )}
    </div>
  );
}
