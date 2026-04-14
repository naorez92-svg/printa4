import os
from flask import Flask, request, Response
import json

app = Flask(__name__)

MANIFEST = json.dumps({
    "name": "PrintA4",
    "short_name": "PrintA4",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#238636",
    "lang": "he", "dir": "rtl",
    "icons": [
        {"src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable"}
    ]
})

ICON_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="36" fill="#0d1117"/>
  <rect x="40" y="30" width="112" height="80" rx="10" fill="#238636"/>
  <rect x="40" y="95" width="112" height="70" rx="8" fill="#161b22"/>
  <rect x="55" y="108" width="82" height="8" rx="3" fill="#30363d"/>
  <rect x="55" y="122" width="60" height="8" rx="3" fill="#30363d"/>
  <rect x="55" y="136" width="72" height="8" rx="3" fill="#30363d"/>
  <text x="96" y="82" font-size="44" text-anchor="middle" fill="white" font-family="Arial">🖨</text>
</svg>'''

SW_JS = """
const CACHE = 'pa4-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/show')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
"""

HTML_UI = r"""<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PrintA4">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#238636">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">
<title>PrintA4</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e6edf3;font-family:'Heebo',sans-serif;min-height:100vh;padding:16px 16px 40px}
.logo{font-size:20px;font-weight:700;margin-bottom:16px;text-align:center;padding:14px 0;border-bottom:1px solid #21262d}
.logo span{color:#2ea043}
.card{background:#161b22;border:1px solid #21262d;border-radius:12px;margin-bottom:10px;overflow:hidden}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#21262d;font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.card-acts{display:flex;gap:5px}
textarea{width:100%;min-height:160px;max-height:280px;background:transparent;color:#e6edf3;border:none;outline:none;padding:12px 14px;font-family:monospace;font-size:11.5px;line-height:1.7;resize:vertical;direction:ltr;text-align:left}
textarea::placeholder{direction:rtl;text-align:right;font-family:'Heebo',sans-serif;font-size:13px;color:#484f58}
.opts{display:flex;gap:8px;padding:10px 14px;flex-wrap:wrap}
select{background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:7px 10px;font-family:inherit;font-size:13px;outline:none}
.btn-sm{padding:3px 9px;border-radius:6px;font-size:11px;font-weight:500;font-family:inherit;border:1px solid #30363d;background:#21262d;color:#8b949e;cursor:pointer}
.btn-sm:hover{color:#e6edf3}
.btn{width:100%;padding:14px;background:#238636;color:white;border:none;border-radius:10px;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:8px;-webkit-tap-highlight-color:transparent}
.btn:active{transform:scale(.97);background:#2ea043}
.btn-sec{background:#21262d;border:1px solid #30363d;color:#e6edf3}
.btn-sec:active{background:#30363d}
.install-btn{display:none;width:100%;padding:12px;background:linear-gradient(135deg,#238636,#2ea043);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:8px}
.ios-tip{display:none;padding:10px 14px;background:rgba(56,139,253,.1);border:1px solid rgba(56,139,253,.3);border-radius:10px;font-size:12px;color:#8b949e;line-height:1.7;margin-bottom:8px}
.ios-tip strong{color:#e6edf3}
.tip{padding:10px 14px;background:#161b22;border-radius:10px;border-right:3px solid #388bfd;font-size:12px;color:#8b949e;line-height:1.7}
.tip strong{color:#e6edf3}
.hist-item{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #21262d;transition:background .1s}
.hist-item:last-child{border-bottom:none}
.hist-item:hover,.hist-item:active{background:#21262d}
.hist-dot{width:6px;height:6px;border-radius:50%;background:#8b5cf6;flex-shrink:0}
.hist-title{flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-meta{font-size:10px;color:#484f58;white-space:nowrap}
.hist-empty{padding:20px;text-align:center;color:#484f58;font-size:13px}
.preview-frame{width:100%;height:400px;border:none;background:white;border-radius:0 0 12px 12px;display:block}
.analysis{display:flex;gap:5px;flex-wrap:wrap;padding:7px 14px;background:#21262d;border-top:1px solid #161b22}
.badge{padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;background:#30363d;color:#484f58;border:1px solid #30363d}
.badge.ok{color:#3fb950;background:rgba(63,185,80,.1);border-color:rgba(63,185,80,.3)}
.badge.warn{color:#d29922;background:rgba(210,153,34,.1);border-color:rgba(210,153,34,.3)}
.toasts{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:400px;z-index:999;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.toast{padding:10px 16px;border-radius:8px;background:#21262d;border:1px solid #30363d;font-size:13px;color:#e6edf3;text-align:center;animation:tin .2s ease,tout .3s ease 2.7s forwards;pointer-events:auto}
.toast.ok{color:#3fb950;border-color:rgba(63,185,80,.35)}
.toast.err{color:#f85149;border-color:rgba(248,81,73,.35)}
@keyframes tin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes tout{from{opacity:1}to{opacity:0;transform:translateY(10px)}}
</style>
</head>
<body>
<div class="logo">🖨 Print<span>A4</span></div>

<button class="install-btn" id="installBtn" onclick="installApp()">⬇ הוסף למסך הבית</button>

<div class="ios-tip" id="iosTip">
  📱 <strong>הוסף למסך הבית:</strong> לחץ על 🔗 שיתוף ← "הוסף למסך הבית"
</div>

<div class="card">
  <div class="card-head">
    📋 קוד HTML
    <div class="card-acts">
      <button class="btn-sm" onclick="showHist()">🕐 היסטוריה</button>
      <button class="btn-sm" onclick="clearAll()">🗑</button>
    </div>
  </div>
  <textarea id="htmlIn" placeholder="הדבק כאן את קוד ה-HTML מ-Gemini..." spellcheck="false" autocorrect="off" autocomplete="off"></textarea>
  <div class="analysis" id="analysis">
    <span class="badge" id="b-page">@page</span>
    <span class="badge" id="b-rtl">RTL</span>
    <span class="badge" id="b-charset">עברית</span>
    <span style="flex:1"></span>
    <span style="font-size:11px;color:#484f58" id="charCount">0 תווים</span>
  </div>
</div>

<div class="card" id="histCard" style="display:none">
  <div class="card-head">
    🕐 מסמכים אחרונים
    <button class="btn-sm" onclick="hideHist()">✕</button>
  </div>
  <div id="histList"></div>
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

<button class="btn" onclick="showPreview()">👁 תצוגה מקדימה</button>

<div class="card" id="previewCard" style="display:none;margin-bottom:10px">
  <div class="card-head">
    תצוגה מקדימה
    <button class="btn-sm" onclick="document.getElementById('previewCard').style.display='none'">✕</button>
  </div>
  <iframe id="previewFrame" class="preview-frame" sandbox="allow-same-origin allow-scripts"></iframe>
</div>

<form id="printForm" method="POST" action="/show" target="_blank" style="display:none">
  <input type="hidden" name="html" id="formHtml">
  <input type="hidden" name="margin" id="formMargin">
  <input type="hidden" name="orient" id="formOrient">
</form>
<button class="btn" onclick="submitPrint()">🖨 פתח להדפסה</button>
<button class="btn btn-sec" onclick="copyHTML()">📋 העתק HTML</button>

<div class="tip">
  <strong>הדפסה מטלפון:</strong> לחץ "פתח להדפסה" ← תפריט כרום ⋮ ← הדפס ← שמור כ-PDF
</div>

<div class="toasts" id="toasts"></div>

<script>
// PWA
let _dip = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); _dip = e;
  document.getElementById('installBtn').style.display = 'block';
});
window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').style.display = 'none';
  toast('✅ הותקן!', 'ok');
});
function installApp() {
  if (!_dip) return;
  _dip.prompt();
  _dip.userChoice.then(r => { if(r.outcome==='accepted') toast('✅ מותקן!','ok'); _dip=null; document.getElementById('installBtn').style.display='none'; });
}
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;
if (isIOS) document.getElementById('iosTip').style.display = 'block';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

// Analysis
function upd(h) {
  const page = /@page/.test(h), rtl = /dir\s*=\s*["']?rtl|direction\s*:\s*rtl/.test(h), cs = /charset.*utf-8/i.test(h);
  const mk = (id, f) => document.getElementById(id).className = 'badge ' + (f ? 'ok' : 'warn');
  mk('b-page', page); mk('b-rtl', rtl); mk('b-charset', cs);
  document.getElementById('charCount').textContent = h.length.toLocaleString() + ' תווים';
}

// Preview
function showPreview() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('הדבק HTML תחילה', 'err'); return; }
  const frame = document.getElementById('previewFrame');
  const card = document.getElementById('previewCard');
  const blob = new Blob([h], {type:'text/html;charset=utf-8'});
  frame.src = URL.createObjectURL(blob);
  card.style.display = 'block';
  card.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// Print
function submitPrint() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('הדבק HTML תחילה', 'err'); return; }
  document.getElementById('formHtml').value = h;
  document.getElementById('formMargin').value = document.getElementById('margin').value;
  document.getElementById('formOrient').value = document.getElementById('orient').value;
  document.getElementById('printForm').submit();
  saveH(h);
}

// Copy
function copyHTML() {
  const h = document.getElementById('htmlIn').value.trim();
  if (!h) { toast('אין HTML להעתקה', 'err'); return; }
  navigator.clipboard.writeText(h).then(() => toast('✓ HTML הועתק', 'ok'));
}

function clearAll() {
  document.getElementById('htmlIn').value = '';
  document.getElementById('previewCard').style.display = 'none';
  upd('');
}

// History
const HK = 'pa4h4';
function saveH(html) {
  try {
    let a = JSON.parse(localStorage.getItem(HK)||'[]');
    const t = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim()
      || html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.replace(/<[^>]+>/g,'').trim()
      || 'מסמך';
    a = a.filter(i => i.html !== html);
    a.unshift({html, t, ts: Date.now(), l: html.length});
    localStorage.setItem(HK, JSON.stringify(a.slice(0,5)));
  } catch{}
}
function showHist() {
  const card = document.getElementById('histCard');
  const list = document.getElementById('histList');
  const a = JSON.parse(localStorage.getItem(HK)||'[]');
  card.style.display = 'block';
  if (!a.length) { list.innerHTML = '<div class="hist-empty">אין מסמכים שמורים עדיין</div>'; return; }
  const f = ts => new Date(ts).toLocaleString('he-IL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  list.innerHTML = a.map((it,i) => `<div class="hist-item" onclick="loadH(${i})">
    <div class="hist-dot"></div>
    <div class="hist-title">${it.t.replace(/</g,'&lt;')}</div>
    <div class="hist-meta">${f(it.ts)}</div>
  </div>`).join('');
}
function hideHist() { document.getElementById('histCard').style.display='none'; }
function loadH(i) {
  const a = JSON.parse(localStorage.getItem(HK)||'[]');
  if (!a[i]) return;
  document.getElementById('htmlIn').value = a[i].html;
  upd(a[i].html);
  hideHist();
  toast('✓ מסמך נטען', 'ok');
}

// Toast
function toast(m, t) {
  const c = document.getElementById('toasts'), el = document.createElement('div');
  el.className = 'toast '+(t||''); el.textContent = m; c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// Events
const ta = document.getElementById('htmlIn'); let _dt;
ta.addEventListener('input', () => { clearTimeout(_dt); _dt = setTimeout(() => upd(ta.value), 200); });
ta.addEventListener('paste', () => { setTimeout(() => { upd(ta.value); if(ta.value.length>50) toast('HTML הודבק ✓','ok'); }, 80); });
upd('');
</script>
</body>
</html>"""

@app.route("/")
def index():
    return Response(HTML_UI, mimetype="text/html; charset=utf-8")

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
    return "ok"

@app.route("/show", methods=["POST"])
def show():
    html = request.form.get("html", "")
    margin = request.form.get("margin", "10mm")
    orient = request.form.get("orient", "portrait")
    if not html.strip():
        return "<h1>אין HTML</h1>", 400
    if "@page" not in html:
        css = f"<style>@page{{size:A4 {orient};margin:{margin}}}*{{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>"
        html = html.replace("</head>", css+"</head>") if "</head>" in html else css+html
    return Response(html, mimetype="text/html; charset=utf-8")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"PrintA4 running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
