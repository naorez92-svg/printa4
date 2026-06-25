import { useState } from "react";
import { supabase } from "../lib/supabase";

const WA = "972509139137";
const BIT_PHONE = "0509139137";

const PLANS = [
  {
    id: "parent",
    icon: "🌟",
    title: "הורה",
    price: 19,
    booklets: 5,
    pages: 10,
    color: "blue",
    features: ["5 חוברות לחודש", "עד 10 עמודים לחוברת", "מפתח תשובות", "שמירה בענן"],
  },
  {
    id: "teacher",
    icon: "🚀",
    title: "מורה פרטית",
    price: 59,
    booklets: 20,
    pages: 20,
    color: "purple",
    badge: "מומלץ",
    features: ["20 חוברות לחודש", "עד 20 עמודים לחוברת", "מפתח תשובות אוטומטי", "ניהול פרופילי תלמידים", "שמירה בענן לצמיתות", "תמיכה אישית ישירה"],
  },
];

export default function UpgradeModal({ onClose, bookletCount = 0 }) {
  const [selectedPlan, setSelectedPlan] = useState("teacher");
  const [name, setName]   = useState("");
  const [sent, setSent]   = useState(false);

  const plan = PLANS.find(p => p.id === selectedPlan);

  const saveLead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("leads").insert({
        user_id: user?.id ?? null,
        name:    name.trim() || null,
        phone:   null,
      });
    } catch (e) {
      console.error("leads insert error:", e);
    }
  };

  const payWithBit = async () => {
    await saveLead();
    const planLabel = plan.id === "teacher" ? "מורה" : "הורה";
    const msg = encodeURIComponent(
      `שלום! אני רוצה לשדרג לתוכנית ${planLabel} בבשבילי ${plan.icon}\nשלחתי ${plan.price} ₪ בביט${name.trim() ? `\nשם: ${name.trim()}` : ""}`
    );
    window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
    setSent(true);
  };

  const sendWhatsApp = async () => {
    await saveLead();
    const planLabel = plan.id === "teacher" ? "מורה" : "הורה";
    const parts = [`שלום! אני רוצה לשדרג לתוכנית ${planLabel} בבשבילי ${plan.icon}`];
    if (name.trim()) parts.push(`שם: ${name.trim()}`);
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank");
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-ink font-display">שדרגי לתוכנית מורה</h2>
            <p className="text-sm text-ink/50">3 חוברות ניסיון · ביטול בכל עת</p>
          </div>
          <button onClick={onClose} className="text-ink/30 hover:text-ink text-3xl leading-none">×</button>
        </div>

        {/* Personalized time-saved hook */}
        {bookletCount > 0 && (
          <div className="bg-grow/8 border border-grow/20 rounded-xl px-3 py-2 text-center">
            <p className="text-xs font-semibold text-grow">
              כבר חסכת ~{bookletCount * 45 >= 60 ? `${(bookletCount * 45 / 60).toFixed(1).replace(".0","")} שעות` : `${bookletCount * 45} דק'`} עם בשבילי 🎉
            </p>
            <p className="text-[10px] text-ink/45 mt-0.5">שדרגי וחסכי עוד 15 שעות בכל חודש</p>
          </div>
        )}

        {/* Value hook — dynamic per plan */}
        {selectedPlan === "teacher" ? (
          <div className="bg-magic/8 border border-magic/20 rounded-2xl px-3 py-2.5 text-right">
            <p className="text-xs font-semibold text-magic">20 חוברות = 20 שעות הכנה שנחסכות 💡</p>
            <p className="text-xs text-ink/60 mt-0.5">מורה פרטית גובה ₪120/שעה — ₪59 לחודש זה <strong className="text-magic">ROI של 40x</strong></p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-right">
            <p className="text-xs font-semibold text-amber-800">5 חוברות אישיות לילד ₪19 בלבד</p>
            <p className="text-xs text-amber-700 mt-0.5">כל חוברת מותאמת לעולם שלו — <strong>₪4 לחוברת</strong></p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlan(p.id)}
              className={`relative rounded-2xl border-2 p-3 text-right transition-all ${
                selectedPlan === p.id
                  ? p.color === "purple"
                    ? "border-magic bg-magic/5"
                    : "border-brand bg-brand/5"
                  : "border-ink/10 hover:border-ink/20"
              }`}
            >
              {p.badge && (
                <span className="absolute -top-2 right-2 bg-magic text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {p.badge}
                </span>
              )}
              <div className="text-2xl mb-1">{p.icon}</div>
              <div className="font-bold text-ink text-sm">{p.title}</div>
              <div className={`font-bold text-lg ${p.color === "purple" ? "text-magic" : "text-brand"}`}>
                ₪{p.price}
                <span className="text-xs font-normal text-ink/40">/חודש</span>
              </div>
              <div className="text-xs text-ink/40 mt-0.5">{p.booklets} חוברות</div>
              <div className={`text-[11px] font-semibold mt-1 ${p.color === "purple" ? "text-magic/70" : "text-brand/70"}`}>
                ≈ ₪{(p.price / p.booklets).toFixed(0)} לחוברת
              </div>
            </button>
          ))}
        </div>

        {/* Selected plan features */}
        <ul className="bg-canvas rounded-2xl p-3 space-y-1.5">
          {plan.features.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink/70">
              <span className={`font-bold text-base ${plan.color === "purple" ? "text-magic" : "text-brand"}`}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        {sent ? (
          <div className="text-center py-3 space-y-3">
            <div className="text-4xl">💙</div>
            <p className="font-semibold text-ink">תשלחי {plan.price} ₪ בביט למספר:</p>
            <p className="text-2xl font-bold text-brand tracking-widest">{BIT_PHONE}</p>
            <p className="text-sm text-ink/50">אחרי ששלחת — שלחי לנו וואטסאפ ונפעיל תוך שעה</p>
            <a
              href={`https://wa.me/${WA}?text=${encodeURIComponent(`שלום! שלחתי ${plan.price} ₪ בביט לתוכנית ${plan.title}, אפשר להפעיל? 🙏`)}`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full bg-[#25D366] text-white rounded-xl p-3 font-semibold text-sm hover:opacity-90 transition-opacity text-center"
            >
              💬 שלחי וואטסאפ לאישור
            </a>
            <button onClick={onClose} className="text-xs text-ink/40 underline hover:text-ink/60">סגור</button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="שם (אופציונלי)"
              value={name}
              onChange={e => setName(e.target.value)}
            />

            <p className="text-xs text-ink/40 font-medium text-center">בחרי אמצעי תשלום:</p>

            <button
              onClick={payWithBit}
              className="w-full bg-[#0095FF] text-white rounded-xl p-3.5 font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              <span className="text-lg">💙</span>
              <span>ביט — ₪{plan.price}</span>
              <span className="text-white/60 text-xs font-normal mr-1">הכי פשוט</span>
            </button>

            <button
              onClick={sendWhatsApp}
              className="w-full border border-[#25D366] text-[#25D366] rounded-xl p-3 font-semibold text-sm hover:bg-[#25D366]/5 transition-colors flex items-center justify-center gap-2"
            >
              💬 תיצרי קשר בוואטסאפ
            </button>

            <p className="text-xs text-ink/30 text-center">ביטול בכל עת · פעילה תוך שעה</p>
          </div>
        )}
      </div>
    </div>
  );
}
