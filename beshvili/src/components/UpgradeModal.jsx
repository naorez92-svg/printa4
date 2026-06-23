import { useState } from "react";
import { supabase } from "../lib/supabase";

const WA = "972509139137";

const FEATURES = [
  "חוברות ללא הגבלה",
  "עד 20 עמודים לחוברת",
  "מפתח תשובות אוטומטי",
  "שמירה בענן לצמיתות",
  "תמיכה אישית ישירה",
];

export default function UpgradeModal({ onClose }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent]   = useState(false);

  const sendLead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    supabase.from("leads").insert({
      user_id: user?.id ?? null,
      name:    name.trim()  || null,
      phone:   phone.trim() || null,
    }).then(() => {});

    const parts = ["שלום! אני רוצה לשדרג לבשבילי פרו 🚀"];
    if (name.trim())  parts.push(`שם: ${name.trim()}`);
    if (phone.trim()) parts.push(`טלפון: ${phone.trim()}`);
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank");
    setSent(true);
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
          <div className="text-center py-3 space-y-2">
            <div className="text-4xl">💬</div>
            <p className="font-semibold text-ink">פתחנו לך וואטסאפ!</p>
            <p className="text-sm text-ink/50">נחזור אליך עם פרטי תשלום תוך זמן קצר</p>
            <button
              onClick={onClose}
              className="text-xs text-ink/40 underline hover:text-ink/60"
            >
              סגור
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink/70">השאירי פרטים ונחזור אליך:</p>
            <input
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="שם (אופציונלי)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="טלפון (אופציונלי)"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <button
              onClick={sendLead}
              className="w-full bg-[#25D366] text-white rounded-xl p-3.5 font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              💬 שלחי פרטים בוואטסאפ
            </button>
            <p className="text-xs text-ink/30 text-center">נצור קשר תוך 24 שעות · ללא התחייבות</p>
          </div>
        )}
      </div>
    </div>
  );
}
