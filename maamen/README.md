# מאמן (MAAMEN)

מאמן תזונה קולי פרואקטיבי בוואטסאפ, בעברית, לשוק הישראלי. MVP בטא לעד 50 משתמשים.
וואטסאפ בלבד — אין אפליקציית מובייל.

שלוש אפליקציות בריפו אחד:
- `server/` — הבוט עצמו (FastAPI + webhook של Green API)
- `admin/` — דשבורד אדמין ב-`/admin` (Basic Auth)
- `landing/` — דף נחיתה ב-`/`

## הרצה מקומית (Windows או Linux)

```bash
cd maamen
pip install -r requirements.txt
uvicorn server.main:app --reload
```

ברירת המחדל היא `MOCK_MODE=true` — הכל רץ בלי אף מפתח API אמיתי.

- דף נחיתה: http://localhost:8000/
- אדמין: http://localhost:8000/admin (צריך להגדיר `ADMIN_PASS` במשתני סביבה)
- בדיקת חיים: http://localhost:8000/health

### סימולציה של הודעת וואטסאפ (בלי וואטסאפ)

```bash
curl -X POST http://localhost:8000/dev/simulate \
  -H "Content-Type: application/json" \
  -d '{"phone": "972501234567", "type": "text", "text": "היי"}'
```

ככה מריצים משתמש שלם: onboarding מלא, ארוחות (`"אכלתי שניצל"`), תמונות
(`"type": "image"`), קול (`"type": "voice"`), פקודות (`"עצור"`, `"משקל 92.5"`).

### טסטים

```bash
cd maamen
python -m pytest tests/ -q
```

## Deploy ל-Railway (בערך 15 דקות)

1. **פרויקט חדש** ב-[Railway](https://railway.app) → Deploy from GitHub repo →
   בחר את הריפו. ב-Settings של הסרוויס הגדר **Root Directory = `maamen`**
   (יש Dockerfile — Railway יזהה לבד).
2. **דיסק קבוע**: Service → Settings → Volumes → Add Volume →
   Mount path: `/app/data` (שם נשמרים ה-SQLite והגיבויים).
3. **משתני סביבה** (Service → Variables) — העתק מ-`.env.example` ומלא:
   - `MOCK_MODE=false`
   - `GREEN_API_ID`, `GREEN_API_TOKEN` — מהקונסולה של Green API
   - `WEBHOOK_SECRET` — מחרוזת אקראית ארוכה שאתה ממציא
   - `ANTHROPIC_API_KEY` — חובה (המוח)
   - `OPENAI_API_KEY` — רשות (תמלול קול; בלעדיו המאמן יבקש לכתוב)
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` — רשות (בלעדיהם הכל טקסט)
   - `ADMIN_USER`, `ADMIN_PASS` — כניסה לאדמין
4. **Webhook ב-Green API**: בקונסולה של Green API → הגדרות ה-instance →
   Webhook URL:
   `https://<הדומיין-שלך-מ-Railway>/webhook/green?token=<WEBHOOK_SECRET>`
   והדלק `incomingMessageReceived`.

### Checklist מעבר ל-Production (MOCK_MODE=false)

- [ ] כל משתני הסביבה מהסעיף למעלה מוגדרים ב-Railway
- [ ] Volume מחובר ל-`/app/data`
- [ ] Webhook URL מוגדר בקונסולת Green API עם הטוקן הנכון
- [ ] `MOCK_MODE=false` והסרוויס עלה מחדש
- [ ] `/dev/simulate` כבר לא קיים (הוא פעיל רק במצב Mock) — זה הסימן שאתה בפרודקשן

### בדיקת עשן ידנית (5 צעדים)

1. פתח את `https://<הדומיין>/health` — אמור לחזור `{"ok": true, "mock_mode": false}`.
2. היכנס ל-`/admin`, הוסף את עצמך כמשתמש בטא (שם + הטלפון שלך).
3. ענה בוואטסאפ על שאלות ההיכרות עד שמתקבל סיכום עם יעד קלורי.
4. שלח תמונה של ארוחה — ודא שמתקבל "רשמתי: ..." עם קלוריות.
5. כתוב "משקל 90" — ודא שנרשם, ושהמשקל מופיע בעמוד המשתמש באדמין.

## מבנה נתונים וגיבויים

SQLite בקובץ `data/maamen.db`. גיבוי יומי אוטומטי ב-03:30 לתיקיית
`data/backups/` (נשמרים 14 אחרונים).

## עקרונות (מהמסמך המקורי)

- MOCK FIRST — כל פיתוח וטסטים רצים בלי מפתחות אמיתיים.
- שבת וחג: אפס הודעות יזומות לשומרי שבת, מחושב לפי זמני מרכז הארץ.
- בקרת עלויות: תקרות יומיות פר-משתמש וגלובלית; בחריגה — מצב תבניות + באנר באדמין.
- אנטי-באן: הודעות נשלחות רק למי שכתב לנו קודם או נוסף ידנית באדמין.
- המאמן לעולם לא נותן ייעוץ רפואי; תוכן רפואי → הפניה לרופא + מצב תמיכה בלבד.
