"""
PrintA4 Cloud — שרת המרת HTML ל-PDF (גרסת ענן)
מנוע: Playwright + Chromium (Docker)
"""

import asyncio
import os
import re
import tempfile

from flask import Flask, jsonify, render_template_string, request, send_file


# ── Emoji replacer ────────────────────────────────────────

def replace_emoji(html: str) -> str:
    replacements = {
        '🏀': '🏀', '⭐': '★', '🎯': '◎', '🏆': '🏆',
        '📋': '📋', '✅': '✓', '❌': '✗', '🔑': '🔑',
        '💡': '💡', '📝': '📝', '🎨': '🎨', '🌟': '★',
        '👑': '♛', '🎉': '✦', '💪': '✊', '🙂': ':)',
        '😊': ':)', '👍': '✓', '🔥': '★', '💯': '100%',
    }
    emoji_pattern = re.compile("["
        u"\U0001F600-\U0001F64F"
        u"\U0001F300-\U0001F5FF"
        u"\U0001F680-\U0001F6FF"
        u"\U0001F1E0-\U0001F1FF"
        u"\U00002500-\U00002BEF"
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        "]+", flags=re.UNICODE)
    for emoji, replacement in replacements.items():
        html = html.replace(emoji, replacement)
    html = emoji_pattern.sub('', html)
    return html


# ── Playwright PDF engine ────────────────────────────────

async def _html_to_pdf(html: str, options: dict) -> bytes:
    from playwright.async_api import async_playwright
    margin = options.get("margin", "10mm")
    orient = options.get("orientation", "portrait")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
            ]
        )
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        await page.wait_for_timeout(1000)
        has_page = "@page" in html
        pdf = await page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
                if has_page else
                {"top": margin, "right": margin, "bottom": margin, "left": margin}
        )
        await browser.close()
        return pdf


def html_to_pdf_sync(html: str, options: dict) -> bytes:
    prepared = smart_inject(html, options)
    return asyncio.run(_html_to_pdf(prepared, options))


# ── Smart CSS Injector ─────────────────────────────────────

def smart_inject(html: str, options: dict) -> str:
    """Add only missing print CSS without overriding existing styles."""
    mode = options.get("inject_mode", "smart")
    margin = options.get("margin", "10mm")
    orient = options.get("orientation", "portrait")

    injections = []

    has_page    = "@page" in html
    has_color   = "print-color-adjust" in html or "-webkit-print-color-adjust" in html
    has_charset = "utf-8" in html.lower()

    if not has_page or mode == "force":
        injections.append(f"@page {{ size: A4 {orient}; margin: {margin}; }}")

    if not has_color or mode == "force":
        injections.append(
            "* { -webkit-print-color-adjust: exact !important; "
            "print-color-adjust: exact !important; }"
        )

    if not has_charset:
        charset_tag = '<meta charset="UTF-8">'
        if "<head>" in html:
            html = html.replace("<head>", "<head>\n" + charset_tag, 1)
        else:
            html = charset_tag + "\n" + html

    if injections:
        style_block = "<style id='__printa4__'>\n" + "\n".join(injections) + "\n</style>"
        if "</head>" in html:
            html = html.replace("</head>", style_block + "\n</head>", 1)
        elif "<body" in html:
            import re
            html = re.sub(r"(<body[^>]*>)", style_block + r"\n\1", html, count=1)
        else:
            html = style_block + "\n" + html

    return html


# ── Flask App ─────────────────────────────────────────────

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10MB


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>PrintA4</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0d1117; --s1: #161b22; --s2: #21262d; --s3: #30363d;
  --bd: rgba(255,255,255,0.08); --bd2: rgba(255,255,255,0.15);
  --tx: #e6edf3; --tx2: #8b949e; --tx3: #484f58;
  --gr: #238636; --gr2: #2ea043; --ac: #388bfd;
  --or: #d29922; --re: #da3633; --pu: #8b5cf6;
  --r: 10px; --r2: 6px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { height: 100%; }
body {
  min-height: 100vh; background: var(--bg); color: var(--tx);
  font-family: 'Heebo', system-ui, sans-serif; font-size: 15px;
  line-height: 1.6;
}

/* ─ Layout ─ */
.page { max-width: 680px; margin: 0 auto; padding: 0 16px 40px; }

/* ─ Header ─ */
.hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 0 14px;
  border-bottom: 1px solid var(--bd); margin-bottom: 20px;
}
.logo { display: flex; align-items: center; gap: 10px; }
.logo-icon {
  width: 36px; height: 36px; border-radius: 9px;
  background: linear-gradient(135deg, #238636, #2ea043);
  display: flex; align-items: center; justify-content: center; font-size: 18px;
}
.logo-title { font-size: 17px; font-weight: 700; letter-spacing: -.3px; }
.logo-sub { font-size: 11px; color: var(--tx3); margin-top: 1px; }
.server-badge {
  font-size: 11px; padding: 3px 9px; border-radius: 20px;
  background: rgba(35,134,54,.15); color: var(--gr2);
  border: 1px solid rgba(35,134,54,.3); font-weight: 500;
}

/* ─ Cards ─ */
.card {
  background: var(--s1); border: 1px solid var(--bd);
  border-radius: var(--r); margin-bottom: 12px; overflow: hidden;
}
.card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px; border-bottom: 1px solid var(--bd);
  background: var(--s2);
}
.card-title { font-size: 11px; font-weight: 600; color: var(--tx2); letter-spacing: .5px; text-transform: uppercase; }
.card-actions { display: flex; gap: 5px; }

/* ─ Textarea ─ */
.html-input {
  width: 100%; min-height: 160px; max-height: 300px;
  padding: 12px 14px;
  background: transparent; color: var(--tx);
  font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; line-height: 1.7;
  border: none; outline: none; resize: vertical;
  direction: ltr; text-align: left;
}
.html-input::placeholder { color: var(--tx3); direction: rtl; text-align: right; font-family: 'Heebo', sans-serif; font-size: 13px; }

/* ─ Analysis strip ─ */
.analysis {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 7px 14px; background: var(--s2); border-top: 1px solid var(--bd);
  font-size: 11px;
}
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 600;
  border: 1px solid var(--bd2); color: var(--tx3); background: var(--s3);
}
.badge.found { color: #3fb950; background: rgba(63,185,80,.1); border-color: rgba(63,185,80,.3); }
.badge.missing { color: var(--or); background: rgba(210,153,34,.1); border-color: rgba(210,153,34,.3); }
.analysis-space { flex: 1; }
.char-count { font-size: 11px; color: var(--tx3); }

/* ─ Options ─ */
.opts { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 14px; }
.opt {
  display: flex; align-items: center; gap: 7px;
  background: var(--s2); border: 1px solid var(--bd);
  border-radius: var(--r2); padding: 6px 12px;
}
.opt-label { font-size: 12px; color: var(--tx2); white-space: nowrap; }
.opt-select {
  background: transparent; border: none; outline: none;
  color: var(--tx); font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer;
}
.opt-select option { background: #21262d; }

/* ─ Buttons ─ */
.actions { display: flex; gap: 8px; padding: 0 0 4px; }
.btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 16px; border-radius: var(--r);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all .15s; border: 1px solid transparent;
  -webkit-tap-highlight-color: transparent;
}
.btn:active { transform: scale(0.96); }
.btn-pdf {
  background: var(--gr); border-color: var(--gr2); color: #fff;
  box-shadow: 0 1px 0 rgba(255,255,255,.1) inset;
}
.btn-pdf:hover { background: var(--gr2); }
.btn-pdf:disabled { background: var(--s3); color: var(--tx3); border-color: var(--bd); cursor: not-allowed; transform: none; }
.btn-sec {
  background: var(--s2); border-color: var(--bd2); color: var(--tx);
  flex: 0; padding: 13px 16px;
}
.btn-sec:hover { background: var(--s3); }

.btn-small {
  padding: 3px 8px; border-radius: var(--r2);
  font-size: 11px; font-weight: 500; font-family: inherit;
  border: 1px solid var(--bd2); background: var(--s3); color: var(--tx2);
  cursor: pointer; transition: all .12s;
}
.btn-small:hover { color: var(--tx); background: #3a414a; }

/* ─ Status ─ */
.status-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--tx2); min-height: 22px; padding: 4px 0;
}
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tx3); flex-shrink: 0; }
.dot.ok { background: #3fb950; }
.dot.working { background: var(--ac); animation: pulse 1s infinite; }
.dot.err { background: var(--re); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

/* ─ Progress bar ─ */
.progress-bar {
  height: 3px; background: var(--s2); border-radius: 3px;
  overflow: hidden; margin: 4px 0;
  display: none;
}
.progress-bar.active { display: block; }
.progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--gr), var(--ac));
  border-radius: 3px;
  animation: progress 1.8s ease-in-out infinite;
}
@keyframes progress {
  0% { width: 0%; margin-right: 100%; }
  50% { width: 60%; margin-right: 0%; }
  100% { width: 0%; margin-right: 100%; }
}

/* ─ Download area ─ */
.download-area {
  display: none; flex-direction: column; align-items: center; gap: 10px;
  padding: 20px; text-align: center;
  background: var(--s1); border: 1px solid rgba(63,185,80,.3);
  border-radius: var(--r); margin-top: 8px;
}
.download-area.visible { display: flex; }
.dl-icon { font-size: 36px; }
.dl-title { font-size: 15px; font-weight: 600; color: #3fb950; }
.dl-sub { font-size: 12px; color: var(--tx2); }
.btn-dl {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 28px; border-radius: var(--r);
  background: var(--gr); color: #fff; border: none;
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all .15s; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.btn-dl:hover { background: var(--gr2); }
.btn-dl:active { transform: scale(0.96); }

/* ─ History ─ */
.history-list { display: flex; flex-direction: column; gap: 1px; }
.hist-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer; transition: background .1s;
  border-bottom: 1px solid var(--bd);
}
.hist-item:last-child { border-bottom: none; }
.hist-item:hover { background: var(--s2); }
.hist-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pu); flex-shrink: 0; }
.hist-title { flex: 1; font-size: 13px; color: var(--tx); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hist-meta { font-size: 10px; color: var(--tx3); white-space: nowrap; }
.hist-empty { padding: 16px; text-align: center; color: var(--tx3); font-size: 12px; }

/* ─ Tips ─ */
.tip {
  padding: 10px 14px; border-radius: var(--r2);
  background: rgba(56,139,253,.08); border-right: 3px solid var(--ac);
  font-size: 12px; color: var(--tx2); line-height: 1.7; margin-top: 8px;
}
.tip strong { color: var(--tx); }

/* ─ Mobile ─ */
@media (max-width: 480px) {
  .hdr { padding: 14px 0 12px; }
  .logo-sub { display: none; }
  .btn .btn-text { display: inline; }
  .opts { gap: 6px; }
  .opt-label { display: none; }
  .html-input { min-height: 140px; font-size: 11px; }
}

/* ─ Toast ─ */
.toasts { position: fixed; bottom: 16px; left: 16px; right: 16px; max-width: 400px; margin: auto; z-index: 999; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.toast {
  padding: 10px 16px; border-radius: var(--r2);
  background: var(--s2); border: 1px solid var(--bd2);
  font-size: 13px; color: var(--tx);
  box-shadow: 0 4px 20px rgba(0,0,0,.5);
  animation: tin .2s ease, tout .3s ease 2.7s forwards;
  pointer-events: auto;
}
.toast.ok { color: #3fb950; border-color: rgba(63,185,80,.35); }
.toast.err { color: #f85149; border-color: rgba(248,81,73,.35); }
@keyframes tin  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes tout { from{opacity:1} to{opacity:0;transform:translateY(12px)} }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <header class="hdr">
    <div class="logo">
      <div class="logo-icon">🖨</div>
      <div>
        <div class="logo-title">PrintA4</div>
        <div class="logo-sub">HTML → PDF מושלם</div>
      </div>
    </div>
    <span class="server-badge" id="serverBadge">● שרת פעיל</span>
  </header>

  <!-- HTML Input -->
  <div class="card">
    <div class="card-head">
      <span class="card-title">📋 קוד HTML</span>
      <div class="card-actions">
        <button class="btn-small" onclick="loadHistory()">📂</button>
        <button class="btn-small" onclick="clearAll()">🗑 נקה</button>
      </div>
    </div>
    <textarea
      class="html-input" id="htmlInput"
      placeholder="הדבק כאן את קוד ה-HTML שיצרת ב-Gemini...&#10;&#10;הכלי ישתמש ב-WeasyPrint להמרה מושלמת לPDF A4."
      spellcheck="false" autocomplete="off" autocorrect="off"
    ></textarea>
    <div class="analysis" id="analysisBar">
      <span class="badge" id="b-page">@page</span>
      <span class="badge" id="b-color">צבעים</span>
      <span class="badge" id="b-rtl">RTL</span>
      <span class="badge" id="b-charset">charset</span>
      <span class="analysis-space"></span>
      <span class="char-count" id="charCount">0 תווים</span>
    </div>
  </div>

  <!-- Options -->
  <div class="card">
    <div class="opts">
      <div class="opt">
        <span class="opt-label">שוליים</span>
        <select class="opt-select" id="marginSel">
          <option value="0mm">ללא</option>
          <option value="5mm">5mm</option>
          <option value="10mm" selected>10mm</option>
          <option value="15mm">15mm</option>
          <option value="20mm">20mm</option>
        </select>
      </div>
      <div class="opt">
        <span class="opt-label">כיוון</span>
        <select class="opt-select" id="orientSel">
          <option value="portrait" selected>לאורך</option>
          <option value="landscape">לרוחב</option>
        </select>
      </div>
      <div class="opt">
        <span class="opt-label">CSS</span>
        <select class="opt-select" id="injectSel">
          <option value="smart" selected>חכם</option>
          <option value="force">כפה</option>
          <option value="minimal">מינימלי</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Status -->
  <div class="status-row">
    <div class="dot" id="statusDot"></div>
    <span id="statusText">הדבק קוד HTML להתחיל</span>
  </div>
  <div class="progress-bar" id="progressBar"><div class="progress-fill"></div></div>

  <!-- Actions -->
  <div class="actions">
    <button class="btn btn-pdf" id="convertBtn" onclick="convertToPDF()">
      <span>📄</span>
      <span class="btn-text">המר ל-PDF</span>
    </button>
    <button class="btn btn-sec" onclick="copyHTML()" title="העתק HTML עם CSS">
      <span>📋</span>
    </button>
    <button class="btn btn-sec" onclick="showHistory()" title="היסטוריה">
      <span>🕐</span>
    </button>
  </div>

  <!-- Download area -->
  <div class="download-area" id="downloadArea">
    <div class="dl-icon">✅</div>
    <div class="dl-title">PDF מוכן להורדה!</div>
    <div class="dl-sub" id="dlSub">המרה הושלמת בהצלחה</div>
    <a class="btn-dl" id="dlLink" href="#" download="print_a4.pdf">⬇ הורד PDF</a>
  </div>

  <!-- History panel -->
  <div class="card" id="historyCard" style="display:none; margin-top: 8px;">
    <div class="card-head">
      <span class="card-title">🕐 מסמכים אחרונים</span>
      <button class="btn-small" onclick="hideHistory()">✕</button>
    </div>
    <div class="history-list" id="historyList"></div>
  </div>

  <!-- Tip -->
  <div class="tip">
    💡 <strong>גרסת ענן — WeasyPrint:</strong> ממיר HTML ל-PDF ישירות בשרת ללא צורך בדפדפן.
  </div>

</div><!-- /page -->

<div class="toasts" id="toasts"></div>

<script>
// ── Analysis ──────────────────────────────────────────────
function analyze(html) {
  return {
    page:    /@page\s*\{/.test(html),
    color:   /print-color-adjust/.test(html),
    rtl:     /dir\s*=\s*["']?rtl|direction\s*:\s*rtl/.test(html),
    charset: /charset.*utf-8/i.test(html),
    len:     html.length
  };
}

function updateAnalysis(html) {
  if (!html) {
    ['b-page','b-color','b-rtl','b-charset'].forEach(id => {
      const el = document.getElementById(id);
      el.className = 'badge';
    });
    document.getElementById('charCount').textContent = '0 תווים';
    setStatus('', 'הדבק קוד HTML להתחיל');
    return;
  }
  const a = analyze(html);
  const mark = (id, found, label) => {
    const el = document.getElementById(id);
    el.className = 'badge ' + (found ? 'found' : 'missing');
    el.title = label + (found ? ' — קיים' : ' — יתווסף');
  };
  mark('b-page',    a.page,    '@page A4');
  mark('b-color',   a.color,   'שמירת צבעים');
  mark('b-rtl',     a.rtl,     'כיוון RTL');
  mark('b-charset', a.charset, 'קידוד עברית');
  document.getElementById('charCount').textContent = a.len.toLocaleString() + ' תווים';

  const missing = [!a.page&&'@page', !a.color&&'צבעים'].filter(Boolean);
  if (missing.length === 0) setStatus('ok', 'HTML מלא — מוכן להמרה');
  else setStatus('', 'יתווסף: ' + missing.join(', '));
}

// ── Status ─────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById('statusDot');
  dot.className = 'dot' + (type ? ' ' + type : '');
  document.getElementById('statusText').textContent = text;
}

// ── Main convert ──────────────────────────────────────────
let _lastPdfURL = null;

async function convertToPDF() {
  const html = document.getElementById('htmlInput').value.trim();
  if (!html) { toast('הדבק קוד HTML תחילה', 'err'); return; }

  const btn = document.getElementById('convertBtn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span><span class="btn-text">ממיר...</span>';
  setStatus('working', 'WeasyPrint מעבד את המסמך...');
  document.getElementById('progressBar').classList.add('active');
  document.getElementById('downloadArea').classList.remove('visible');

  try {
    const body = {
      html,
      margin:       document.getElementById('marginSel').value,
      orientation:  document.getElementById('orientSel').value,
      inject_mode:  document.getElementById('injectSel').value,
    };

    const resp = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `שגיאה ${resp.status}`);
    }

    const blob = await resp.blob();
    const size  = (blob.size / 1024).toFixed(1);

    if (_lastPdfURL) URL.revokeObjectURL(_lastPdfURL);
    _lastPdfURL = URL.createObjectURL(blob);

    document.getElementById('dlLink').href = _lastPdfURL;
    document.getElementById('dlSub').textContent = `${size} KB · A4 · WeasyPrint`;
    document.getElementById('downloadArea').classList.add('visible');

    setStatus('ok', `✓ PDF מוכן — ${size}KB`);
    toast('✓ PDF הומר בהצלחה!', 'ok');
    saveHistory(html);

  } catch(e) {
    setStatus('err', 'שגיאה: ' + e.message);
    toast('שגיאה: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>📄</span><span class="btn-text">המר ל-PDF</span>';
    document.getElementById('progressBar').classList.remove('active');
  }
}

// ── Copy with injected CSS ────────────────────────────────
function copyHTML() {
  const html = document.getElementById('htmlInput').value.trim();
  if (!html) { toast('אין HTML להעתקה', 'err'); return; }
  navigator.clipboard.writeText(html).then(() => toast('✓ HTML הועתק', 'ok'));
}

// ── History ───────────────────────────────────────────────
const HIST_KEY = 'printa4_history_v2';

function saveHistory(html) {
  try {
    let items = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    const title = html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim()
      || html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.replace(/<[^>]+>/g,'').trim()
      || 'מסמך';
    items = items.filter(i => i.html !== html);
    items.unshift({ html, title, ts: Date.now(), len: html.length });
    localStorage.setItem(HIST_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {}
}

function showHistory() {
  const card = document.getElementById('historyCard');
  const list  = document.getElementById('historyList');
  const items = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
  card.style.display = 'block';
  if (!items.length) {
    list.innerHTML = '<div class="hist-empty">אין מסמכים שמורים עדיין</div>';
    return;
  }
  const fmt = ts => new Date(ts).toLocaleString('he-IL', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  list.innerHTML = items.map((it, i) => `
    <div class="hist-item" onclick="restoreHistory(${i})">
      <div class="hist-dot"></div>
      <div class="hist-title">${it.title.replace(/</g,'&lt;')}</div>
      <div class="hist-meta">${fmt(it.ts)} · ${it.len.toLocaleString()}</div>
    </div>
  `).join('');
}

function hideHistory() { document.getElementById('historyCard').style.display = 'none'; }
function loadHistory()  { showHistory(); }

function restoreHistory(idx) {
  const items = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
  if (!items[idx]) return;
  document.getElementById('htmlInput').value = items[idx].html;
  updateAnalysis(items[idx].html);
  hideHistory();
  toast('✓ מסמך נטען', 'ok');
}

function clearAll() {
  document.getElementById('htmlInput').value = '';
  document.getElementById('downloadArea').classList.remove('visible');
  updateAnalysis('');
  toast('נוקה', '');
}

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type) {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Events ───────────────────────────────────────────────
const ta = document.getElementById('htmlInput');
let _debounce;
ta.addEventListener('input', () => {
  clearTimeout(_debounce);
  _debounce = setTimeout(() => updateAnalysis(ta.value), 250);
});
ta.addEventListener('paste', () => {
  setTimeout(() => { updateAnalysis(ta.value); if(ta.value.length>50) toast('HTML הודבק ✓','ok'); }, 80);
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); convertToPDF(); }
});

updateAnalysis('');
</script>
</body>
</html>"""


@app.route("/")
def index():
    return render_template_string(HTML_PAGE)


@app.route("/convert", methods=["POST"])
def convert():
    """Receive HTML, return PDF bytes."""
    data = request.get_json(force=True)
    if not data or not data.get("html"):
        return jsonify({"error": "חסר קוד HTML"}), 400

    options = {
        "margin":       data.get("margin", "10mm"),
        "orientation":  data.get("orientation", "portrait"),
        "inject_mode":  data.get("inject_mode", "smart"),
    }

    try:
        pdf_bytes = html_to_pdf_sync(data["html"], options)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
        f.write(pdf_bytes)
        tmp_path = f.name

    response = send_file(
        tmp_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name="print_a4.pdf",
    )

    @response.call_on_close
    def cleanup():
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return response


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ── Entry point ───────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"PrintA4 Cloud — http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
