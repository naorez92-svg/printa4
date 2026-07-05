import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";
import { checkCompassPaid } from "./api";
import { scoreRiasec, scoreValues } from "./scoring";
import { Btn, CompassMark } from "./ui";

// מצפן — the paywall between the completed journey and the report.
// The journey (assessment + interview) is free; producing the full report is
// paid. Payment is Bit + WhatsApp confirmation (the same manual flow as
// beshvili plan upgrades — no card integration yet); the admin flips
// profiles.compass_paid and the user taps "בדקו שוב". The Edge Function
// enforces the entitlement server-side regardless of anything on this screen.

const WA = "972509139137";
const PRICE = 49;
const ANCHOR = 179;

const openWhatsApp = (url) => {
  // In-app browsers (Instagram/Facebook webview) return null from window.open.
  const w = window.open(url, "_blank");
  if (!w) location.href = url;
};

export default function Paywall({ journey, nextStage }) {
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const checkedOnMount = useRef(false);

  const name = journey.answers?.background?.name || "";
  const riasec = scoreRiasec(journey.answers?.riasec);
  const topValues = scoreValues(journey.answers?.values).slice(0, 3).filter((v) => v.score >= 4);

  // Already entitled (returning buyer / admin) → skip straight to the analysis.
  useEffect(() => {
    if (checkedOnMount.current) return;
    checkedOnMount.current = true;
    track("compass_paywall_view", {});
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ""), () => {});
    checkCompassPaid().then((paid) => { if (paid) nextStage(); }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payBit = () => {
    const cleanPhone = phone.trim().replace(/[^\d+]/g, "").slice(0, 20) || null;
    track("compass_pay_click", { method: "bit", price: PRICE, phone_given: !!cleanPhone });
    // Heads-up for the admin inbox (reuses the existing notify-lead function).
    supabase.functions.invoke("notify-lead", {
      body: { name: name || null, phone: cleanPhone, plan: "compass", price: PRICE, method: "bit" },
    }).catch(() => {});
    const msg = encodeURIComponent(
      `שלום! שילמתי ${PRICE} ₪ בביט על דוח מצפן 🧭\nהמייל שלי: ${email || "(המייל שאיתו נרשמתי)"}${name ? `\nשם: ${name}` : ""}\nאפשר להפעיל לי את הדוח?`,
    );
    setSent(true);
    openWhatsApp(`https://wa.me/${WA}?text=${msg}`);
  };

  const recheck = async () => {
    setChecking(true);
    setNotYet(false);
    try {
      const paid = await checkCompassPaid();
      if (paid) {
        track("compass_paid_confirmed", {});
        nextStage();
        return;
      }
      setNotYet(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center animate-[fadeIn_0.4s_ease] py-4">
      <div className="text-center mb-6">
        <CompassMark size={52} className="mx-auto mb-3" />
        <p className="text-grow text-sm font-semibold mb-1">✓ המסע הושלם{name ? `, ${name}` : ""}!</p>
        <h2 className="text-3xl font-bold font-display mb-2">הדוח שלך מוכן להפקה</h2>
        <p className="text-white/50 text-sm max-w-sm mx-auto">
          צוות המומחים כבר קיבל את כל הנתונים. נשאר רק להפעיל אותו.
        </p>
      </div>

      {/* Free teaser — real value from the data they already gave */}
      <div className="bg-white/5 border border-magic/30 rounded-2xl p-5 mb-5">
        <p className="text-xs font-semibold text-magic mb-3">🔍 הצצה ממה שכבר גילינו עליך</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-1.5" dir="ltr">
            {riasec.code.split("").map((c) => (
              <span key={c} className="w-9 h-9 rounded-xl bg-gradient-to-br from-magic to-brand flex items-center justify-center font-bold text-lg">
                {c}
              </span>
            ))}
          </div>
          <div className="text-sm text-white/70">
            קוד ההולנד שלך: <strong className="text-white">{riasec.top.map((t) => t.label).join(" · ")}</strong>
          </div>
        </div>
        {topValues.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topValues.map((v) => (
              <span key={v.id} className="text-xs bg-white/10 border border-white/15 rounded-full px-3 py-1 text-white/70">
                💎 {v.label.split(" — ")[0]}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-white/35 mt-3">…וזה רק הקצה. הדוח המלא מחבר הכל לתשובה אחת.</p>
      </div>

      {/* What's inside */}
      <div className="space-y-2 mb-5">
        {[
          "ניתוח של 3 מומחי AI — פסיכולוג, מומחה חוזקות ואסטרטג קריירה",
          "3 כיווני קריירה מדורגים עם אחוזי התאמה וטווחי שכר בישראל",
          "תשובה חדה: מה ללמוד, איפה, כמה זמן וכמה זה עולה",
          "מפת דרכים אישית — מהחודש הקרוב ועד 3 שנים קדימה",
          "מכתב אישי + גישה לדוח לתמיד, מכל מכשיר",
        ].map((f) => (
          <div key={f} className="flex items-start gap-2.5 text-sm text-white/75">
            <span className="text-grow mt-0.5 flex-shrink-0">✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {/* Price + CTA */}
      <div className="bg-gradient-to-br from-magic/20 to-brand/15 border border-magic/40 rounded-3xl p-6 text-center">
        {sent ? (
          <div className="space-y-4">
            <p className="font-bold text-lg">💬 מחכים לאישור</p>
            <p className="text-sm text-white/60 leading-relaxed">
              ברגע שהתשלום יאושר (בדרך כלל תוך דקות), לחץ על הכפתור והדוח שלך יתחיל להיכתב.
            </p>
            <Btn onClick={recheck} disabled={checking} className="w-full">
              {checking ? "בודק…" : "שילמתי — בדקו שוב ✓"}
            </Btn>
            {notYet && <p className="text-xs text-amber-300">עוד לא אושר — נסה שוב בעוד רגע, או כתוב לנו בוואטסאפ</p>}
            <button onClick={() => setSent(false)} className="text-xs text-white/35 underline hover:text-white/60">
              חזרה
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-1">
              <span className="text-white/35 line-through text-lg">₪{ANCHOR}</span>
              <span className="text-4xl font-bold font-display text-brand">₪{PRICE}</span>
            </div>
            <p className="text-xs text-white/45 mb-1">מחיר השקה · תשלום חד-פעמי · בלי מנוי</p>
            <p className="text-xs text-white/35 mb-4">להשוואה: פגישת ייעוץ קריירה אחת עולה ₪800–1,500</p>

            {/* Optional phone — incentive-framed, never blocks the purchase */}
            <div className="text-right mb-4">
              <label htmlFor="pw-phone" className="text-xs text-white/50 block mb-1.5">
                📱 טלפון <span className="text-white/30">(לא חובה)</span> — כדי שנוכל לעדכן אותך
                בוואטסאפ ברגע שהדוח מופעל
              </label>
              <input
                id="pw-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 outline-none focus:border-magic transition-colors text-center text-sm"
              />
            </div>

            <Btn onClick={payBit} className="w-full text-lg py-4 mb-3">
              💳 שלם ₪{PRICE} בביט והפק את הדוח
            </Btn>
            <p className="text-xs text-white/40 leading-relaxed">
              התשלום בביט למספר 050-9139137 · אחרי התשלום תיפתח הודעת וואטסאפ לאישור מהיר
            </p>
            <p className="text-[11px] text-white/30 leading-relaxed mt-2">
              אפשר לבטל ולקבל החזר מלא עד תחילת הפקת הדוח · בתשלום אתה מאשר את{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-white/60">התקנון</a>
            </p>
          </>
        )}
      </div>

      <p className="text-center text-xs text-white/30 mt-4">
        כל התשובות שלך שמורות בחשבון — אפשר לחזור ולשלם מתי שתרצה 🤍
      </p>
    </div>
  );
}
