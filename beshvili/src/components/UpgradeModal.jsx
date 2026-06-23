import { useState } from "react";
import { supabase } from "../lib/supabase";

const WA = "972509139137";
const BIT_PHONE = "0509139137";
// Replace with your actual PayBox payment link from payboxapp.com dashboard
const PAYBOX_LINK = "https://payboxapp.page.link/YOUR_PAYBOX_LINK";

const FEATURES = [
  "חוברות ללא הגבלה (עד 20 בחודש)",
  "עד 20 עמודים לחוברת",
  "מפתח תשובות אוטומטי",
  "שמירה בענן לצמיתות",
  "תמיכה אישית ישירה",
];

export default function UpgradeModal({ onClose }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent]   = useState(false);

  const saveLead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("leads").insert({
        user_id: user?.id ?? null,
        name:    name.trim()  || null,
        phone:   phone.trim() || null,
      });
      if (error) console.error("leads insert failed:", error.message);
    } catch (e) {
      console.error("leads insert error:", e);
    }
  };

  const payWithBit = async () => {
    await saveLead();
    const msg = encodeURIComponent(`שלום! אני רוצה לשדרג לבשבילי פרו 🚀\nשלחתי 30 ₪ בביט${name.trim() ? `\nשם: ${name.trim()}` : ""}`);
    // Open Bit app deep link, fallback to WhatsApp instructions
    window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
    setSent("bit");
  };

  const payWithPayBox = async () => {
    await saveLead();
    window.open(PAYBOX_LINK, "_blank");
    setSent("paybox");
  };

  const sendWhatsApp = async () => {
    await saveLead();
    const parts = ["שלום! אני רוצה לשדרג לבשבילי פרו 🚀"];
    if (name.trim())  parts.push(`שם: ${name.trim()}`);
    if (phone.trim()) parts.push(`טלפון: ${phone.trim()}`);
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank");
    setSent("wa");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-4xl mb-1">🚀</div>
            <h2 className="text-xl font-bold text-ink font-display">שדרגי לפרו</h2>
            <p className="text-sm text-ink/50">₪30/חודש · ביטול בכל עת</p>
          </div>
          <button onClick={onClose} className="text-ink/30 hover:text-ink text-3xl leading-none">×</button>
        </div>

        {/* Features */}
        <ul className="bg-canvas rounded-2xl p-4 space-y-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink/70">
              <span className="text-magic font-bold text-base">✓</span>{f}
            </li>
          ))}
        </ul>

        {sent ? (
          <div className="text-center py-3 space-y-3">
            <div className="text-4xl">{sent === "bit" ? "💙" : "🎉"}</div>
            <p className="font-semibold text-ink">
              {sent === "bit" ? "תשלחי 30 ₪ בביט למספר:" : "תודה! העברנו אותך לתשלום"}
            </p>
            {sent === "bit" && (
              <p className="text-2xl font-bold text-brand tracking-widest">{BIT_PHONE}</p>
            )}
            <p className="text-sm text-ink/50">
              {sent === "bit"
                ? "אחרי ששלחת — שלחי לנו וואטסאפ ונפעיל תוך שעה"
                : "אחרי התשלום שלחי לנו וואטסאפ ונפעיל תוך שעה"}
            </p>
            <a
              href={`https://wa.me/${WA}?text=${encodeURIComponent("שלום! שלחתי 30 ₪, אפשר להפעיל פרו? 🙏")}`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full bg-[#25D366] text-white rounded-xl p-3 font-semibold text-sm hover:opacity-90 transition-opacity text-center"
            >
              💬 שלחי וואטסאפ לאישור
            </a>
            <button onClick={onClose} className="text-xs text-ink/40 underline hover:text-ink/60">סגור</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink/70">השאירי שם (אופציונלי):</p>
            <input
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="שם"
              value={name}
              onChange={e => setName(e.target.value)}
            />

            <p className="text-xs text-ink/40 font-medium text-center pt-1">בחרי אמצעי תשלום:</p>

            {/* Bit */}
            <button
              onClick={payWithBit}
              className="w-full bg-[#0095FF] text-white rounded-xl p-3.5 font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              <span className="text-lg">💙</span>
              <span>ביט — ₪30</span>
              <span className="text-white/60 text-xs font-normal mr-1">הכי פשוט</span>
            </button>

            {/* PayBox */}
            {PAYBOX_LINK !== "https://payboxapp.page.link/YOUR_PAYBOX_LINK" && (
              <button
                onClick={payWithPayBox}
                className="w-full bg-gradient-to-l from-brand to-magic text-white rounded-xl p-3.5 font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
              >
                💳 PayBox — ₪30
              </button>
            )}

            {/* WhatsApp fallback */}
            <button
              onClick={sendWhatsApp}
              className="w-full border border-[#25D366] text-[#25D366] rounded-xl p-3 font-semibold text-sm hover:bg-[#25D366]/5 transition-colors flex items-center justify-center gap-2"
            >
              💬 תיצרי קשר בוואטסאפ
            </button>

            <p className="text-xs text-ink/30 text-center">תשלום מאובטח · ביטול בכל עת · פעילה תוך שעה</p>
          </div>
        )}
      </div>
    </div>
  );
}
