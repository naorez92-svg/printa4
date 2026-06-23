"""
Batch booklet generator — submits multiple PrintA4 booklets in one Batch API call
at 50% of standard pricing. Results are saved as HTML files.

Usage:
    python batch_generate.py
"""

import anthropic
import time
import os
import json
from pathlib import Path
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

BOOKLET_SYSTEM = """אתה "יוצר החוברות של חני 2.0" — מומחה פדגוגי בכיר, מעצב גרפי לפרינט ומפתח HTML/CSS.
מטרתך: לייצר קוד HTML מלא לחוברות עבודה לימודיות לילדים ברמה עיצובית גבוהה, חסכוניות בדיו, מוכנות להדפסה בפורמט A4.

=== חוקי CSS A4 (חובה בכל עמוד!) ===
• כל div עמוד: width:210mm; height:296mm; margin:10px auto; overflow:hidden; page-break-after:always; box-sizing:border-box; position:relative; padding:12mm;
• סגנון הדפסה: @page{size:A4;margin:0} @media print{.no-print{display:none!important}}
• שמירת צבעים: -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important

=== עקרונות עיצוב ===
• Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
• Google Fonts: Fredoka לכותרות, Varela Round לטקסט
• רקעים בהירים בלבד — bg-white, bg-orange-50, bg-blue-50, bg-green-50, bg-purple-50, bg-yellow-50
• מסגרות מעוצבות: rounded-2xl, shadow-md, border
• אימוג'ים לתמיכה חזותית בכל פעילות
• שורות כתיבה: border-b border-gray-300 h-8 w-full mb-2
• עיצוב עקבי לאורך כל העמודים סביב עולם התוכן של הילד

=== מבנה 5 עמודים (חובה בדיוק!) ===
עמוד 1 — שער אישי והעצמה
עמוד 2 — חימום (ידע וזיהוי)
עמוד 3 — ליבת הלמידה (הבנה ויישום)
עמוד 4 — חשיבה מחוץ לקופסה (אנליזה)
עמוד 5 — דו"ח סקאוט / רפלקציה

=== פלט (חשוב מאוד!) ===
• קוד HTML גולמי בלבד — החל מ-<!DOCTYPE html> עד </html>
• ללא ```html, ללא הסברים, ללא שום טקסט לפני או אחרי
• כפתור הדפסה ממוסגר עם class="no-print" בראש הדף
• עברית תקינה, מלאה ועשירה
• כל 5 העמודים בקובץ HTML אחד"""


def build_user_msg(name: str, age: str, theme: str, goal: str,
                   level: str = "בינוני", special: str = "") -> str:
    return (
        f"צור חוברת עבודה לפי הפרמטרים הבאים:\n\n"
        f"שם הילד/ה: {name}\n"
        f"גיל/כיתה: {age or 'לא צוין'}\n"
        f"עולם תוכן: {theme or 'כללי'}\n"
        f"יעד פדגוגי: {goal}\n"
        f"רמת אתגר: {level}\n"
        f"התאמות מיוחדות: {special or 'ללא'}\n\n"
        f"צור HTML מלא עם כל 5 העמודים לפי המבנה הפדגוגי. קוד HTML גולמי בלבד, ללא הסברים."
    )


def main():
    client = anthropic.Anthropic()

    # Define the booklets to generate in this batch
    booklets = [
        {"name": "יוסי", "age": "כיתה ג", "theme": "כדורגל",
         "goal": "חיבור וחיסור עד 1000", "level": "בינוני"},
        {"name": "מיכל", "age": "כיתה ב", "theme": "חיות וטבע",
         "goal": "קריאת מילים בניקוד מלא", "level": "בסיסי"},
        {"name": "דניאל", "age": "כיתה ד", "theme": "חלל וחייזרים",
         "goal": "שברים: חצי, שליש, רבע", "level": "מתקדם"},
    ]

    requests = [
        Request(
            custom_id=f"booklet-{b['name']}",
            params=MessageCreateParamsNonStreaming(
                model="claude-opus-4-8",
                max_tokens=10000,
                system=BOOKLET_SYSTEM,
                messages=[{"role": "user", "content": build_user_msg(**b)}],
            ),
        )
        for b in booklets
    ]

    # 1. Submit batch
    print(f"Submitting batch of {len(requests)} booklets...")
    batch = client.messages.batches.create(requests=requests)
    print(f"Batch ID: {batch.id}")
    print(f"Status:   {batch.processing_status}")

    # 2. Poll until complete (batches usually finish within minutes to 1 hour)
    poll_interval = 30
    while True:
        batch = client.messages.batches.retrieve(batch.id)
        counts = batch.request_counts
        print(
            f"  processing={counts.processing}  "
            f"succeeded={counts.succeeded}  "
            f"errored={counts.errored}"
        )
        if batch.processing_status == "ended":
            break
        time.sleep(poll_interval)

    print(f"\nBatch ended — succeeded={batch.request_counts.succeeded}, "
          f"errored={batch.request_counts.errored}")

    # 3. Save results
    out_dir = Path("batch_output")
    out_dir.mkdir(exist_ok=True)

    for result in client.messages.batches.results(batch.id):
        if result.result.type == "succeeded":
            msg = result.result.message
            html = next((b.text for b in msg.content if b.type == "text"), "")
            # Strip any accidental markdown fences
            if html.startswith("```"):
                html = html.split("\n", 1)[1].rsplit("```", 1)[0]
            out_path = out_dir / f"{result.custom_id}.html"
            out_path.write_text(html, encoding="utf-8")
            print(f"  Saved: {out_path}  ({len(html):,} chars)")
        elif result.result.type == "errored":
            err = result.result.error
            print(f"  ERROR [{result.custom_id}]: {err.type}")
        elif result.result.type == "expired":
            print(f"  EXPIRED [{result.custom_id}] — resubmit")

    print(f"\nDone. Files saved to ./{out_dir}/")


if __name__ == "__main__":
    main()
