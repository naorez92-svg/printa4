import os, base64, json
from flask import Flask, request, Response, stream_with_context

try:
    import anthropic as _ant
    _KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    _client = _ant.Anthropic(api_key=_KEY) if _KEY else None
    HAS_AI = bool(_KEY)
except Exception:
    _client = None
    HAS_AI = False

app = Flask(__name__)

MANIFEST = json.dumps({
    "name": "PrintA4 — יוצר חוברות חני",
    "short_name": "PrintA4",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#238636",
    "lang": "he", "dir": "rtl",
    "icons": [{"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"}]
})

ICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="36" fill="#0d1117"/>
  <rect x="40" y="30" width="112" height="80" rx="10" fill="#238636"/>
  <rect x="40" y="95" width="112" height="70" rx="8" fill="#161b22"/>
  <rect x="55" y="108" width="82" height="8" rx="3" fill="#30363d"/>
  <rect x="55" y="122" width="60" height="8" rx="3" fill="#30363d"/>
  <rect x="55" y="136" width="72" height="8" rx="3" fill="#30363d"/>
  <text x="96" y="82" font-size="44" text-anchor="middle" fill="white" font-family="Arial">&#128424;</text>
</svg>'''

SW_JS = """
const CACHE='pa4-v3';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>self.clients.claim());
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/api/'))return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
"""

BOOKLET_SYSTEM = """אתה "יוצר החוברות של חני 2.0" — מומחה פדגוגי בכיר, מעצב גרפי לפרינט ומפתח HTML/CSS.
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
• ללא ```html, ללא הסברים, ללא שום טקסט לפני או אחרי
• כפתור הדפסה ממוסגר עם class="no-print" בראש הדף
• עברית תקינה, מלאה ועשירה
• כל 5 העמודים בקובץ HTML אחד"""

HTML_UI = r"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PrintA4">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#238636">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">
<title>PrintA4 — יוצר חוברות חני</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:'Heebo',sans-serif;min-height:100vh;padding:14px 14px 60px}
.logo{font-size:19px;font-weight:700;margin-bottom:12px;text-align:center;padding:12px 0;border-bottom:1px solid #21262d}
.logo .g{color:#2ea043}.logo .sub{font-size:10px;font-weight:400;color:#484f58;display:block;margin-top:2px}
.tabs{display:flex;gap:3px;background:#161b22;border:1px solid #21262d;border-radius:10px;padding:4px;margin-bottom:12px}
.tab{flex:1;padding:8px 4px;border-radius:7px;border:none;background:transparent;color:#8b949e;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
.tab.active{background:#21262d;color:#e6edf3;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.card{background:#161b22;border:1px solid #21262d;border-radius:12px;margin-bottom:10px;overflow:hidden}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#21262d;font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.card-acts{display:flex;gap:5px}
textarea.code{width:100%;min-height:220px;background:transparent;color:#e6edf3;border:none;outline:none;padding:12px 14px;font-family:monospace;font-size:11.5px;line-height:1.7;resize:vertical;direction:ltr;text-align:left}
textarea.code::placeholder{direction:rtl;text-align:right;font-family:'Heebo',sans-serif;font-size:13px;color:#484f58}
.opts{display:flex;gap:8px;padding:10px 14px;flex-wrap:wrap;align-items:center}
select{background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:7px 10px;font-family:inherit;font-size:13px;outline:none}
.btn{width:100%;padding:14px;background:#238636;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:8px;-webkit-tap-highlight-color:transparent}
.btn:active{transform:scale(.97)}
.btn-sec{background:#21262d;border:1px solid #30363d;color:#e6edf3}
.btn-purple{background:#6e40c9;color:white}
.btn-purple:active{background:#7c4dd8}
.btn-sm{padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;font-family:inherit;border:1px solid #30363d;background:#21262d;color:#8b949e;cursor:pointer}
.btn-sm:hover{color:#e6edf3}
.install-btn{display:none;width:100%;padding:12px;background:linear-gradient(135deg,#238636,#2ea043);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:8px}
.ios-tip{display:none;padding:10px 14px;background:rgba(56,139,253,.1);border:1px solid rgba(56,139,253,.3);border-radius:10px;font-size:12px;color:#8b949e;line-height:1.7;margin-bottom:8px}
.ios-tip strong{color:#e6edf3}
.analysis{display:flex;gap:5px;flex-wrap:wrap;padding:7px 14px;background:#21262d;border-top:1px solid #161b22}
.badge{padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;background:#30363d;color:#484f58;border:1px solid #30363d}
.badge.ok{color:#3fb950;background:rgba(63,185,80,.1);border-color:rgba(63,185,80,.3)}
.badge.warn{color:#d29922;background:rgba(210,153,34,.1);border-color:rgba(210,153,34,.3)}
.preview-frame{width:100%;height:430px;border:none;background:white;border-radius:0 0 12px 12px;display:block}
.hist-item{display:flex;align-items:center;gap:9px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #21262d;transition:background .1s}
.hist-item:last-child{border-bottom:none}
.hist-item:hover{background:#21262d}
.hist-dot{width:6px;height:6px;border-radius:50%;background:#8b5cf6;flex-shrink:0}
.hist-title{flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-meta{font-size:10px;color:#484f58;white-space:nowrap;margin-left:4px}
.hist-del{width:20px;height:20px;border:none;background:transparent;color:#484f58;cursor:pointer;font-size:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.hist-del:hover{color:#f85149}
.hist-empty{padding:24px;text-align:center;color:#484f58;font-size:13px;line-height:1.8}
.form-wrap{padding:14px}
.form-label{display:block;font-size:11px;font-weight:600;color:#8b949e;margin-bottom:5px;text-transform:uppercase;letter-spacing:.3px}
.form-input{width:100%;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:9px 12px;font-family:inherit;font-size:14px;outline:none;direction:rtl;margin-bottom:12px}
.form-input:focus{border-color:#388bfd}
.form-textarea{min-height:60px;resize:vertical;line-height:1.5}
.level-btns{display:flex;gap:6px;margin-bottom:12px}
.level-btn{flex:1;padding:8px 4px;border:1px solid #30363d;background:#21262d;color:#8b949e;border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer;text-align:center;transition:all .15s}
.level-btn.active{border-color:#8b5cf6;background:rgba(139,92,246,.15);color:#c4b5fd}
.tmpl-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.tmpl-btn{padding:5px 10px;border:1px solid #21262d;background:#0d1117;color:#8b949e;border-radius:20px;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
.tmpl-btn:hover{border-color:#30363d;color:#e6edf3}
.stream-box{background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:10px;margin:0 14px 14px;font-family:monospace;font-size:10px;color:#3fb950;max-height:180px;overflow-y:auto;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all}
.progress-wrap{padding:0 14px 14px}
.progress{height:3px;background:#21262d;border-radius:2px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,#238636,#8b5cf6,#238636);background-size:200% 100%;border-radius:2px;animation:prog 1.8s linear infinite;width:100%}
@keyframes prog{0%{background-position:0% 0}100%{background-position:200% 0}}
.no-api-warn{padding:14px;background:rgba(210,153,34,.08);border:1px solid rgba(210,153,34,.3);border-radius:8px;margin:14px;font-size:12px;color:#d29922;line-height:1.8}
.no-api-warn a{color:#e3b341}
.success-box{padding:14px;background:rgba(63,185,80,.08);border:1px solid rgba(63,185,80,.3);border-radius:8px;margin:0 0 10px;font-size:13px;color:#3fb950;line-height:1.6}
.tip{padding:10px 14px;background:#161b22;border-radius:10px;border-right:3px solid #388bfd;font-size:12px;color:#8b949e;line-height:1.7;margin-bottom:8px}
.tip strong{color:#e6edf3}
.sep{height:1px;background:#21262d;margin:4px 0 8px}
.toasts{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:400px;z-index:999;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.toast{padding:10px 16px;border-radius:8px;background:#21262d;border:1px solid #30363d;font-size:13px;color:#e6edf3;text-align:center;animation:tin .2s ease,tout .3s ease 2.7s forwards}
.toast.ok{color:#3fb950;border-color:rgba(63,185,80,.35)}.toast.err{color:#f85149;border-color:rgba(248,81,73,.35)}
@keyframes tin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes tout{from{opacity:1}to{opacity:0;transform:translateY(10px)}}
.hidden{display:none!important}
</style>
</head>
<body>

<button class="install-btn" id="installBtn" onclick="installApp()">&#8595; הוסף למסך הבית</button>
<div class="ios-tip" id="iosTip">&#128241; <strong>הוסף למסך הבית:</strong> לחץ שיתוף &#8592; "הוסף למסך הבית"</div>

<div class="logo">&#128424; Print<span class="g">A4</span>
  <span class="sub">יוצר חוברות לימודיות &mdash; חני עזרא</span>
</div>

<div class="tabs">
  <button class="tab active" id="tab-btn-editor" onclick="showTab('editor',this)">&#9998; עורך</button>
  <button class="tab" id="tab-btn-gen" onclick="showTab('gen',this)">&#10024; יצירת חוברת</button>
  <button class="tab" id="tab-btn-hist" onclick="showTab('hist',this)">&#128218; היסטוריה</button>
</div>

<!-- ======= TAB: EDITOR ======= -->
<div id="tab-editor">

<div class="card">
  <div class="card-head">
    &#128196; קוד HTML
    <div class="card-acts">
      <label class="btn-sm" style="cursor:pointer" title="ייבוא קובץ HTML">
        &#128193; ייבוא
        <input type="file" accept=".html,.htm" id="fileIn" style="display:none" onchange="importFile(this)">
      </label>
      <button class="btn-sm" onclick="clearAll()" title="נקה">&#128465;</button>
    </div>
  </div>
  <textarea class="code" id="htmlIn" placeholder="הדבק כאן קוד HTML... או לחץ &#10024; יצירת חוברת כדי לייצר עם AI" spellcheck="false" autocorrect="off" autocomplete="off"></textarea>
  <div class="analysis" id="analysis">
    <span class="badge" id="b-page">@page</span>
    <span class="badge" id="b-rtl">RTL</span>
    <span class="badge" id="b-charset">UTF-8</span>
    <span style="flex:1"></span>
    <span style="font-size:11px;color:#484f58" id="wordCount">0 מילים</span>
    <span style="font-size:11px;color:#30363d;margin:0 4px">|</span>
    <span style="font-size:11px;color:#484f58" id="charCount">0 תווים</span>
  </div>
</div>

<div class="card">
  <div class="opts">
    <select id="margin">
      <option value="0mm">ללא שוליים</option>
      <option value="10mm" selected>שוליים 10mm</option>
      <option value="15mm">שוליים 15mm</option>
      <option value="20mm">שוליים 20mm</option>
    </select>
    <select id="orient">
      <option value="portrait" selected>לאורך A4</option>
      <option value="landscape">לרוחב A4</option>
    </select>
  </div>
</div>

<button class="btn" onclick="showPreview()">&#128065; תצוגה מקדימה</button>

<div class="card hidden" id="previewCard" style="margin-bottom:10px">
  <div class="card-head">
    תצוגה מקדימה
    <button class="btn-sm" onclick="document.getElementById('previewCard').classList.add('hidden')">&#10005;</button>
  </div>
  <iframe id="previewFrame" class="preview-frame" sandbox="allow-same-origin allow-scripts"></iframe>
</div>

<button class="btn" onclick="submitPrint()">&#128424; פתח להדפסה</button>
<button class="btn btn-sec" onclick="copyHTML()">&#128203; העתק HTML</button>
<button class="btn btn-sec" onclick="downloadHTML()">&#128190; הורד HTML</button>

<div class="tip">
  <strong>הדפסה מטלפון:</strong> לחץ "פתח להדפסה" &#8592; תפריט &#8942; &#8592; הדפס &#8592; שמור כ-PDF
</div>

</div>

<!-- ======= TAB: GENERATOR ======= -->
<div id="tab-gen" class="hidden">

<div id="noApiWarn" class="no-api-warn hidden">
  &#9888;&#65039; <strong>מפתח API לא מוגדר.</strong><br>
  כדי להפעיל את יוצר החוברות, הגדר משתנה סביבה <code>ANTHROPIC_API_KEY</code>.<br>
  ניתן להשיג מפתח ב-<a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>
</div>

<!-- Form -->
<div class="card" id="genForm">
  <div class="card-head">&#10024; יוצר החוברות של חני</div>
  <div class="form-wrap">

    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#8b949e;margin-bottom:7px;font-weight:600">&#9889; תבניות מהירות</div>
      <div class="tmpl-row">
        <button class="tmpl-btn" onclick="fillTmpl('כדורגל','כיתה ב','כדורגל','חיבור וחיסור עד 100 ללא מעבר עשרת','בינוני','')">&#9917; כדורגל + חיבור</button>
        <button class="tmpl-btn" onclick="fillTmpl('גיימינג','כיתה ג','גיימינג ומשחקי וידאו','לוח כפל: 6, 7, 8','בסיסי','')">&#127918; גיימינג + כפל</button>
        <button class="tmpl-btn" onclick="fillTmpl('חיות','כיתה א','חיות וטבע','קריאת מילים בניקוד מלא','בסיסי','')">&#128038; חיות + קריאה</button>
        <button class="tmpl-btn" onclick="fillTmpl('חלל','כיתה ד','חלל וחייזרים','שברים: חצי, שליש, רבע','מתקדם','')">&#128640; חלל + שברים</button>
        <button class="tmpl-btn" onclick="fillTmpl('בישול','כיתה ה','בישול ואפייה','שטח והיקף של צורות','מתקדם','')">&#128293; בישול + גאומטריה</button>
      </div>
    </div>

    <label class="form-label">שם הילד/ה *</label>
    <input class="form-input" id="f-name" placeholder="למשל: יוסי, מיכל, דניאל..." type="text" autocomplete="off">

    <label class="form-label">גיל / כיתה</label>
    <input class="form-input" id="f-age" placeholder="למשל: כיתה ג, 9 שנים..." type="text" autocomplete="off">

    <label class="form-label">עולם תוכן אהוב &#127918;</label>
    <input class="form-input" id="f-theme" placeholder="כדורגל, חלל, נינג'ה, בישול, סוסים, מוזיקה..." type="text" autocomplete="off">

    <label class="form-label">יעד פדגוגי *</label>
    <textarea class="form-input form-textarea" id="f-goal" placeholder="מה נלמד? למשל: חיבור וחיסור עד 1000, קריאת שעון, פרשנות טקסט..."></textarea>

    <label class="form-label">רמת אתגר</label>
    <div class="level-btns">
      <button class="level-btn" id="lvl-basic" onclick="setLevel('בסיסי','lvl-basic')">&#127807; בסיסי</button>
      <button class="level-btn active" id="lvl-mid" onclick="setLevel('בינוני','lvl-mid')">&#9889; בינוני</button>
      <button class="level-btn" id="lvl-adv" onclick="setLevel('מתקדם','lvl-adv')">&#128640; מתקדם</button>
    </div>

    <label class="form-label">התאמות מיוחדות (אופציונלי)</label>
    <input class="form-input" id="f-special" placeholder="ריווח כפול, פונט גדול, הפחתת גירויים, קשב וריכוז..." type="text" autocomplete="off">

    <button class="btn btn-purple" style="margin-top:4px" onclick="startGenerate()">&#10024; צור חוברת עם AI</button>
  </div>
</div>

<!-- Progress -->
<div class="card hidden" id="genProgress">
  <div class="card-head">&#9881;&#65039; Claude מייצר את החוברת...</div>
  <div style="padding:12px 14px 4px;font-size:12px;color:#8b949e">30-90 שניות בממוצע לחוברת מלאה עם 5 עמודים</div>
  <div class="progress-wrap"><div class="progress"><div class="progress-bar"></div></div></div>
  <div class="stream-box" id="streamBox"></div>
  <div style="padding:0 14px 14px"><button class="btn btn-sec" onclick="cancelGen()">&#10005; ביטול</button></div>
</div>

<!-- Done -->
<div class="card hidden" id="genDone">
  <div class="card-head">&#9989; החוברת מוכנה!</div>
  <div style="padding:14px">
    <div class="success-box" id="genStats"></div>
    <button class="btn" onclick="loadGenerated()">&#9998; טען לעורך &#8592; הדפס</button>
    <button class="btn btn-sec" onclick="previewGenerated()">&#128065; תצוגה מקדימה</button>
    <button class="btn btn-sec" onclick="downloadGenerated()">&#128190; הורד HTML</button>
    <button class="btn btn-sec" onclick="resetGen()">&#10024; צור חוברת חדשה</button>
  </div>
</div>

</div>

<!-- ======= TAB: HISTORY ======= -->
<div id="tab-hist" class="hidden">
<div class="card">
  <div class="card-head">
    &#128218; מסמכים שמורים (עד 30)
    <div class="card-acts">
      <button class="btn-sm" onclick="loadHistList()">&#8635; רענן</button>
      <button class="btn-sm" onclick="clearHistory()">&#128465; נקה הכל</button>
    </div>
  </div>
  <div id="histList"></div>
</div>
<div style="text-align:center;font-size:11px;color:#30363d;margin-top:6px;padding-bottom:8px" id="histCap"></div>
</div>

<div class="toasts" id="toasts"></div>

<script>
const HAS_AI = %%HAS_AI%%;

// ===== PWA =====
let _dip = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _dip = e; document.getElementById('installBtn').style.display = 'block'; });
window.addEventListener('appinstalled', () => { document.getElementById('installBtn').style.display = 'none'; toast('הותקן!', 'ok'); });
function installApp() { if (!_dip) return; _dip.prompt(); _dip.userChoice.then(r => { if (r.outcome === 'accepted') toast('מותקן!', 'ok'); _dip = null; document.getElementById('installBtn').style.display = 'none'; }); }
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) document.getElementById('iosTip').style.display = 'block';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ===== TABS =====
function showTab(id, btn) {
  ['editor','gen','hist'].forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
  document.getElementById('tab-' + id).classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (id === 'hist') loadHistList();
  if (id === 'gen') initGenTab();
}

// ===== EDITOR =====
function upd(h) {
  const mk = (id, f) => document.getElementById(id).className = 'badge ' + (f ? 'ok' : 'warn');
  mk('b-page', /@page/.test(h));
  mk('b-rtl', /dir\s*=\s*["']?rtl|direction\s*:\s*rtl/.test(h));
  mk('b-charset', /charset.*utf-8/i.test(h));
  document.getElementById('charCount').textContent = h.length.toLocaleString() + ' תווים';
  document.getElementById('wordCount').textContent = (h.trim() ? h.trim().split(/\s+/).length : 0).toLocaleString() + ' מילים';
}

function showPreview() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('הדבק HTML תחילה', 'err'); return; }
  const card = document.getElementById('previewCard');
  document.getElementById('previewFrame').src = URL.createObjectURL(new Blob([h], { type: 'text/html;charset=utf-8' }));
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function submitPrint() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('הדבק HTML תחילה', 'err'); return; }
  const margin = document.getElementById('margin').value;
  const orient = document.getElementById('orient').value;
  let html = h;
  if (!html.includes('@page')) {
    const css = '<style>@page{size:A4 ' + orient + ';margin:' + margin + '}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style>';
    html = html.includes('</head>') ? html.replace('</head>', css + '</head>') : css + html;
  }
  const w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
  if (w) { saveDoc(h); toast('נפתח — הדפס מהתפריט', 'ok'); }
  else toast('אפשר חלונות קופצים בכרום', 'err');
}

function copyHTML() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('אין HTML', 'err'); return; }
  navigator.clipboard.writeText(h).then(() => toast('הועתק!', 'ok'));
}

function downloadHTML() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('אין HTML', 'err'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([h], { type: 'text/html;charset=utf-8' }));
  a.download = 'booklet.html'; a.click();
  toast('מוריד...', 'ok');
}

function importFile(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('htmlIn').value = e.target.result;
    upd(e.target.result);
    toast('יובא: ' + f.name, 'ok');
  };
  r.readAsText(f, 'utf-8');
  inp.value = '';
}

function clearAll() {
  document.getElementById('htmlIn').value = '';
  document.getElementById('previewCard').classList.add('hidden');
  upd('');
}

const _ta = document.getElementById('htmlIn');
let _dt;
_ta.addEventListener('input', () => { clearTimeout(_dt); _dt = setTimeout(() => upd(_ta.value), 200); });
_ta.addEventListener('paste', () => { setTimeout(() => { upd(_ta.value); if (_ta.value.length > 100) toast('HTML הודבק', 'ok'); }, 80); });

// Drag & drop HTML file onto textarea
_ta.addEventListener('dragover', e => { e.preventDefault(); _ta.style.background = 'rgba(56,139,253,.07)'; });
_ta.addEventListener('dragleave', () => { _ta.style.background = ''; });
_ta.addEventListener('drop', e => {
  e.preventDefault(); _ta.style.background = '';
  const f = e.dataTransfer.files[0];
  if (!f || !f.name.match(/\.html?$/i)) { toast('רק קבצי HTML', 'err'); return; }
  const r = new FileReader();
  r.onload = ev => { _ta.value = ev.target.result; upd(_ta.value); toast('גרור + שחרר: ' + f.name, 'ok'); };
  r.readAsText(f, 'utf-8');
});

upd('');

// ===== IndexedDB HISTORY (30 docs, ~50MB capacity) =====
let _idb = null;
const IDB = 'pa4db3', IDB_S = 'docs', MAX_DOCS = 30;

function openDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_S)) db.createObjectStore(IDB_S, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}

async function saveDoc(html) {
  try {
    const db = await openDB();
    const t = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim()
            || html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.replace(/<[^>]+>/g,'').trim()
            || 'מסמך ' + new Date().toLocaleDateString('he-IL');
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_S, 'readwrite');
      tx.objectStore(IDB_S).add({ html, t, ts: Date.now(), l: html.length });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    const all = await getDocs();
    if (all.length > MAX_DOCS) {
      const db2 = await openDB();
      await new Promise((res, rej) => {
        const tx = db2.transaction(IDB_S, 'readwrite');
        all.slice(MAX_DOCS).forEach(d => tx.objectStore(IDB_S).delete(d.id));
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    }
  } catch(e) { console.warn('saveDoc:', e); }
}

function getDocs() {
  return openDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(IDB_S, 'readonly').objectStore(IDB_S).getAll();
    req.onsuccess = () => res((req.result || []).sort((a, b) => b.ts - a.ts));
    req.onerror = () => rej(req.error);
  }));
}

function deleteDocById(id) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(IDB_S, 'readwrite');
    tx.objectStore(IDB_S).delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  }));
}

async function loadHistList() {
  const list = document.getElementById('histList');
  const cap = document.getElementById('histCap');
  try {
    const docs = await getDocs();
    if (!docs.length) {
      list.innerHTML = '<div class="hist-empty">אין מסמכים שמורים עדיין<br><small>מסמכים נשמרים אוטומטית לאחר הדפסה או יצירה</small></div>';
      cap.textContent = '';
      return;
    }
    const fmtDate = ts => new Date(ts).toLocaleString('he-IL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const fmtSize = l => l > 102400 ? (l/1024/1024).toFixed(1)+'MB' : Math.round(l/1024)+'KB';
    list.innerHTML = docs.map(d => `
      <div class="hist-item" onclick="loadDocById(${d.id})">
        <div class="hist-dot"></div>
        <div class="hist-title">${(d.t||'מסמך').replace(/</g,'&lt;').substring(0,55)}</div>
        <div class="hist-meta">${fmtDate(d.ts)}&nbsp;·&nbsp;${fmtSize(d.l)}</div>
        <button class="hist-del" onclick="event.stopPropagation();removeDoc(${d.id})" title="מחק">&#10005;</button>
      </div>`).join('');
    const tot = docs.reduce((s,d) => s+d.l, 0);
    cap.textContent = docs.length + '/' + MAX_DOCS + ' מסמכים · ' + (tot/1024/1024).toFixed(1) + 'MB בשימוש';
  } catch(e) {
    list.innerHTML = '<div class="hist-empty">שגיאה בטעינת היסטוריה</div>';
  }
}

async function loadDocById(id) {
  try {
    const db = await openDB();
    const doc = await new Promise((res, rej) => {
      const req = db.transaction(IDB_S,'readonly').objectStore(IDB_S).get(id);
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
    if (!doc) return;
    document.getElementById('htmlIn').value = doc.html;
    upd(doc.html);
    showTab('editor', document.getElementById('tab-btn-editor'));
    toast('נטען: ' + (doc.t||'מסמך'), 'ok');
  } catch(e) { toast('שגיאה בטעינה', 'err'); }
}

async function removeDoc(id) {
  await deleteDocById(id);
  loadHistList();
  toast('נמחק', 'ok');
}

async function clearHistory() {
  if (!confirm('למחוק את כל ההיסטוריה?')) return;
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_S,'readwrite');
    tx.objectStore(IDB_S).clear();
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  loadHistList();
  toast('היסטוריה נמחקה', 'ok');
}

// ===== GENERATOR =====
let _genHtml = '';
let _genCtrl = null;
let _selLevel = 'בינוני';

function initGenTab() {
  if (!HAS_AI) {
    document.getElementById('noApiWarn').classList.remove('hidden');
    document.getElementById('genForm').classList.add('hidden');
  }
}

function setLevel(lvl, btnId) {
  _selLevel = lvl;
  ['lvl-basic','lvl-mid','lvl-adv'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(btnId).classList.add('active');
}

function fillTmpl(topic, age, theme, goal, level, special) {
  document.getElementById('f-age').value = age;
  document.getElementById('f-theme').value = theme;
  document.getElementById('f-goal').value = goal;
  document.getElementById('f-special').value = special;
  const map = { 'בסיסי': 'lvl-basic', 'בינוני': 'lvl-mid', 'מתקדם': 'lvl-adv' };
  setLevel(level, map[level] || 'lvl-mid');
  document.getElementById('f-name').focus();
  toast('תבנית ' + topic + ' נטענה', 'ok');
}

async function startGenerate() {
  const name = document.getElementById('f-name').value.trim();
  const goal = document.getElementById('f-goal').value.trim();
  if (!name) { toast('יש להזין שם', 'err'); document.getElementById('f-name').focus(); return; }
  if (!goal) { toast('יש להזין יעד פדגוגי', 'err'); document.getElementById('f-goal').focus(); return; }

  const payload = {
    name,
    age:     document.getElementById('f-age').value.trim(),
    theme:   document.getElementById('f-theme').value.trim(),
    goal,
    level:   _selLevel,
    special: document.getElementById('f-special').value.trim()
  };

  document.getElementById('genForm').classList.add('hidden');
  document.getElementById('genProgress').classList.remove('hidden');
  document.getElementById('genDone').classList.add('hidden');
  const streamBox = document.getElementById('streamBox');
  streamBox.textContent = '';
  _genHtml = '';
  _genCtrl = new AbortController();

  try {
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: _genCtrl.signal
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'שגיאת שרת ' + resp.status }));
      throw new Error(err.error || 'שגיאת שרת');
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.t) {
              _genHtml += d.t;
              streamBox.textContent = '...' + _genHtml.slice(-600);
              streamBox.scrollTop = streamBox.scrollHeight;
            } else if (d.error) {
              throw new Error(d.error);
            }
          } catch(parseErr) { /* skip bad frames */ }
        }
      }
    }

    if (!_genHtml.trim()) throw new Error('לא התקבל תוכן מ-Claude');

    document.getElementById('genProgress').classList.add('hidden');
    document.getElementById('genDone').classList.remove('hidden');
    const words = _genHtml.trim().split(/\s+/).length;
    document.getElementById('genStats').innerHTML =
      '&#127881; החוברת נוצרה!<br>' +
      '<span style="font-size:12px;color:#8b949e">' +
      _genHtml.length.toLocaleString() + ' תווים &middot; ' +
      words.toLocaleString() + ' מילים &middot; 5 עמודי A4' +
      '</span>';

  } catch(e) {
    if (e.name === 'AbortError') { toast('בוטל', 'ok'); }
    else { toast('שגיאה: ' + e.message, 'err'); }
    document.getElementById('genProgress').classList.add('hidden');
    document.getElementById('genForm').classList.remove('hidden');
  }
}

function cancelGen() {
  if (_genCtrl) _genCtrl.abort();
  document.getElementById('genProgress').classList.add('hidden');
  document.getElementById('genForm').classList.remove('hidden');
}

function extractHTML(raw) {
  const m = raw.match(/<!DOCTYPE\s+html[\s\S]*/i) || raw.match(/<html[\s\S]*/i);
  return m ? m[0] : raw;
}

function loadGenerated() {
  const html = extractHTML(_genHtml);
  document.getElementById('htmlIn').value = html;
  upd(html);
  saveDoc(html);
  showTab('editor', document.getElementById('tab-btn-editor'));
  toast('חוברת נטענה לעורך', 'ok');
}

function previewGenerated() {
  const html = extractHTML(_genHtml);
  document.getElementById('htmlIn').value = html;
  upd(html);
  saveDoc(html);
  showTab('editor', document.getElementById('tab-btn-editor'));
  setTimeout(showPreview, 80);
}

function downloadGenerated() {
  const html = extractHTML(_genHtml);
  const name = document.getElementById('f-name').value.trim() || 'חוברת';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = name + '_חוברת.html';
  a.click();
  saveDoc(html);
  toast('מוריד...', 'ok');
}

function resetGen() {
  _genHtml = '';
  document.getElementById('genDone').classList.add('hidden');
  document.getElementById('genForm').classList.remove('hidden');
}

// ===== TOAST =====
function toast(m, t) {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (t||'');
  el.textContent = m;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
</script>
</body>
</html>"""


@app.route("/")
def index():
    html = HTML_UI.replace('%%HAS_AI%%', 'true' if HAS_AI else 'false')
    return Response(html, mimetype="text/html; charset=utf-8")


@app.route("/api/generate", methods=["POST"])
def api_generate():
    if not HAS_AI or not _client:
        return Response(
            json.dumps({"error": "מפתח ANTHROPIC_API_KEY לא מוגדר בשרת"}, ensure_ascii=False),
            status=503, mimetype="application/json"
        )

    data = request.get_json(force=True) or {}
    name    = data.get("name", "").strip()
    age     = data.get("age", "").strip()
    theme   = data.get("theme", "").strip()
    goal    = data.get("goal", "").strip()
    level   = data.get("level", "בינוני").strip()
    special = data.get("special", "").strip()

    if not name or not goal:
        return Response(
            json.dumps({"error": "שם ויעד פדגוגי הם שדות חובה"}, ensure_ascii=False),
            status=400, mimetype="application/json"
        )

    user_msg = (
        f"צור חוברת עבודה לפי הפרמטרים הבאים:\n\n"
        f"שם הילד/ה: {name}\n"
        f"גיל/כיתה: {age or 'לא צוין'}\n"
        f"עולם תוכן: {theme or 'כללי'}\n"
        f"יעד פדגוגי: {goal}\n"
        f"רמת אתגר: {level}\n"
        f"התאמות מיוחדות: {special or 'ללא'}\n\n"
        f"צור HTML מלא עם כל 5 העמודים לפי המבנה הפדגוגי. קוד HTML גולמי בלבד, ללא הסברים."
    )

    def gen():
        try:
            with _client.messages.stream(
                model="claude-opus-4-8",
                max_tokens=10000,
                system=BOOKLET_SYSTEM,
                messages=[{"role": "user", "content": user_msg}]
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'t': text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(gen()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.route("/manifest.json")
def manifest():
    return Response(MANIFEST, mimetype="application/manifest+json")


@app.route("/icon.svg")
def icon():
    return Response(ICON_SVG, mimetype="image/svg+xml")


@app.route("/sw.js")
def sw():
    return Response(SW_JS, mimetype="application/javascript")


@app.route("/health")
def health():
    return Response(json.dumps({"ok": True, "ai": HAS_AI}), mimetype="application/json")


@app.route("/show", methods=["POST", "GET"])
def show():
    raw    = request.form.get("html", "") or request.args.get("html", "")
    margin = request.form.get("margin", "10mm") or request.args.get("margin", "10mm")
    orient = request.form.get("orient", "portrait") or request.args.get("orient", "portrait")

    if not raw.strip():
        return "<h1>אין HTML</h1>", 400

    try:
        html = base64.b64decode(raw).decode("utf-8")
    except Exception:
        html = raw

    if "@page" not in html:
        css = f"<style>@page{{size:A4 {orient};margin:{margin}}}*{{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>"
        html = html.replace("</head>", css + "</head>") if "</head>" in html else css + html

    return Response(html, mimetype="text/html; charset=utf-8")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"PrintA4 running on port {port} | AI agent: {'enabled' if HAS_AI else 'disabled (set ANTHROPIC_API_KEY)'}")
    app.run(host="0.0.0.0", port=port, debug=False)
