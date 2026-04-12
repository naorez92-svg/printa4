import os
from flask import Flask, request, Response

app = Flask(__name__)

HTML_UI = """<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>PrintA4</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e6edf3; font-family: 'Heebo', sans-serif; min-height: 100vh; padding: 20px; }
.logo { font-size: 22px; font-weight: 700; margin-bottom: 20px; text-align: center; }
.logo span { color: #2ea043; }
textarea {
  width: 100%; height: 200px;
  background: #161b22; color: #e6edf3;
  border: 1px solid #30363d; border-radius: 10px;
  padding: 12px; font-family: monospace; font-size: 12px;
  resize: vertical; direction: ltr; text-align: left;
}
textarea::placeholder { direction: rtl; text-align: right; font-family: 'Heebo', sans-serif; font-size: 13px; color: #484f58; }
.opts { display: flex; gap: 8px; margin: 10px 0; flex-wrap: wrap; }
select { background: #161b22; color: #e6edf3; border: 1px solid #30363d; border-radius: 8px; padding: 8px 12px; font-family: inherit; font-size: 13px; }
.btn {
  width: 100%; padding: 14px;
  background: #238636; color: white; border: none;
  border-radius: 10px; font-size: 16px; font-weight: 700;
  font-family: inherit; cursor: pointer; margin-top: 10px;
}
.btn:active { background: #2ea043; transform: scale(0.98); }
.tip { margin-top: 16px; padding: 12px; background: #161b22; border-radius: 10px; border-right: 3px solid #388bfd; font-size: 13px; color: #8b949e; line-height: 1.7; }
.tip strong { color: #e6edf3; }
</style>
</head>
<body>
<div class="logo">🖨 Print<span>A4</span></div>
<form method="POST" action="/show" target="_blank">
  <textarea name="html" placeholder="הדבק כאן את קוד ה-HTML מ-Gemini..."></textarea>
  <div class="opts">
    <select name="margin">
      <option value="0mm">ללא שוליים</option>
      <option value="10mm" selected>שוליים 10mm</option>
      <option value="15mm">שוליים 15mm</option>
    </select>
    <select name="orient">
      <option value="portrait" selected>לאורך</option>
      <option value="landscape">לרוחב</option>
    </select>
  </div>
  <button class="btn" type="submit">👁 הצג להדפסה</button>
</form>
<div class="tip">
  <strong>איך מדפיסים מהטלפון:</strong><br>
  1. לחץ "הצג להדפסה"<br>
  2. נפתח הדף שלך<br>
  3. תפריט כרום ⋮ ← הדפס ← שמור כ-PDF
</div>
</body>
</html>"""

@app.route("/")
def index():
    return HTML_UI

@app.route("/show", methods=["POST"])
def show():
    html = request.form.get("html", "")
    margin = request.form.get("margin", "10mm")
    orient = request.form.get("orient", "portrait")

    if not html.strip():
        return "<h1>אין HTML</h1>", 400

    # הוסף רק @page אם חסר
    if "@page" not in html:
        page_css = f"<style>@page{{size:A4 {orient};margin:{margin}}}*{{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>"
        if "</head>" in html:
            html = html.replace("</head>", page_css + "</head>")
        else:
            html = page_css + html

    return Response(html, mimetype="text/html; charset=utf-8")

@app.route("/health")
def health():
    return "ok"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    print(f"PrintA4 running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
