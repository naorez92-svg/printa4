import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";

const WA = "972509139137";
const BIT_PHONE = "0509139137";
const SALE_EXPIRY_KEY = "beshvili_sale_expiry";
const SALE_HOURS = 48;

const PLANS = [
  {
    id: "parent",
    icon: "🌟",
    title: "הורה",
    price: 19,
    salePrice: 9,
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
    salePrice: 29,
    booklets: 20,
    pages: 20,
    color: "purple",
    badge: "מומלץ",
    features: ["20 חוברות לחודש", "עד 20 עמודים לחוברת", "מפתח תשובות אוטומטי", "ניהול פרופילי תלמידים", "שמירה בענן לצמיתות", "תמיכה אישית ישירה"],
  },
];

function getOrCreateSaleExpiry() {
  try {
    let expiry = localStorage.getItem(SALE_EXPIRY_KEY);
    if (!expiry) {
      expiry = String(Date.now() + SALE_HOURS * 3600 * 1000);
      localStorage.setItem(SALE_EXPIRY_KEY, expiry);
    }
    return Number(expiry);
  } catch {
    return 0; // storage blocked (private browsing, ITP) — show no timer
  }
}

function getSecondsLeft() {
  return Math.max(0, Math.floor((getOrCreateSaleExpiry() - Date.now()) / 1000));
}

function formatCountdown(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function UpgradeModal({ onClose, bookletCount = 0, source = "unknown" }) {
  const [selectedPlan, setSelectedPlan] = useState("teacher");
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent]   = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);
  const [lockedPrice, setLockedPrice] = useState(null);

  const plan = PLANS.find(p => p.id === selectedPlan);
  const saleActive = secondsLeft > 0;
  const effectivePrice = saleActive ? plan.salePrice : plan.price;
  // Snapshot at click time so the sent-state UI never changes price after timer expires.
  const displayPrice = lockedPrice ?? effectivePrice;

  useEffect(() => { track("upgrade_modal_opened", { source, bookletCount }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(getSecondsLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close on Esc — keyboard/screen-reader users must be able to dismiss the modal
  // without relying on the mouse-only backdrop click.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveLead = (method) => {
    track("upgrade_cta_clicked", { method, plan: plan.id, price: effectivePrice, sale_active: saleActive, source, bookletCount });
    supabase.functions
      .invoke("notify-lead", {
        body: {
          name: name.trim() || null,
          phone: phone.trim() || null,
          plan: plan.id,
          price: effectivePrice,
          method,
          bookletCount,
        },
      })
      .then(({ error }) => { if (error) console.error("notify-lead error:", error); })
      .catch((e) => console.error("notify-lead invoke failed:", e));
  };

  const payWithBit = () => {
    const planLabel = plan.id === "teacher" ? "מורה" : "הורה";
    const saleNote = saleActive ? " (מחיר מבצע לחודש ראשון)" : "";
    const msg = encodeURIComponent(
      `שלום! אני רוצה לשדרג לתוכנית ${planLabel} בבשבילי ${plan.icon}\nשלחתי ${effectivePrice} ₪ בביט${saleNote}${name.trim() ? `\nשם: ${name.trim()}` : ""}`
    );
    window.open(`https://wa.me/${WA}?text=${msg}`, "_blank");
    setLockedPrice(effectivePrice);
    saveLead("bit");
    setSent(true);
  };

  const sendWhatsApp = () => {
    const planLabel = plan.id === "teacher" ? "מורה" : "הורה";
    const parts = [`שלום! אני רוצה לשדרג לתוכנית ${planLabel} בבשבילי ${plan.icon}`];
    if (saleActive) parts.push(`(ראיתי את מחיר המבצע — ₪${effectivePrice} לחודש ראשון)`);
    if (name.trim()) parts.push(`שם: ${name.trim()}`);
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(parts.join("\n"))}`, "_blank");
    setLockedPrice(effectivePrice);
    saveLead("whatsapp");
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl max-h-[95vh] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6 pb-3 space-y-4">

        {/* Sale countdown banner */}
        {saleActive && (
          <div className="bg-gradient-to-l from-red-500 to-orange-400 rounded-2xl px-4 py-2.5 text-white text-center -mx-2">
            <p className="text-[11px] font-bold tracking-wide">🔥 מחיר מיוחד לחודש הראשון — נגמר בעוד</p>
            <p className="font-mono text-2xl font-bold tracking-widest leading-tight">{formatCountdown(secondsLeft)}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 id="upgrade-modal-title" className="text-xl font-bold text-ink font-display">שדרגי לבשבילי פרו</h2>
            <p className="text-sm text-ink/50">2 חוברות ניסיון · ביטול בכל עת</p>
          </div>
          <button onClick={onClose} aria-label="סגור" className="text-ink/30 hover:text-ink text-3xl leading-none">×</button>
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
            <p className="text-xs text-ink/60 mt-0.5">
              {saleActive
                ? <>מורה פרטית גובה ₪120/שעה — ₪29 לחודש ראשון זה <strong className="text-magic">ROI של 80x</strong></>
                : <>מורה פרטית גובה ₪120/שעה — ₪59 לחודש זה <strong className="text-magic">ROI של 40x</strong></>}
            </p>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 text-right">
            <p className="text-xs font-semibold text-amber-800">5 חוברות אישיות לילד</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {saleActive
                ? <>₪9 לחודש ראשון — <strong>₪1.80 לחוברת בלבד!</strong></>
                : <>₪19 לחודש — <strong>₪4 לחוברת</strong></>}
            </p>
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
              {saleActive && (
                <span className="absolute -top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  מבצע
                </span>
              )}
              <div className="text-2xl mb-1">{p.icon}</div>
              <div className="font-bold text-ink text-sm">{p.title}</div>
              <div className={`font-bold ${p.color === "purple" ? "text-magic" : "text-brand"}`}>
                {saleActive ? (
                  <>
                    <del className="text-ink/30 text-xs font-normal">₪{p.price}</del>
                    <span className="text-lg text-red-500"> ₪{p.salePrice}</span>
                    <span className="text-[10px] font-normal text-ink/40 block leading-tight">חודש ראשון</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">₪{p.price}</span>
                    <span className="text-xs font-normal text-ink/40">/חודש</span>
                  </>
                )}
              </div>
              <div className="text-xs text-ink/40 mt-0.5">{p.booklets} חוברות</div>
              {!saleActive && (
                <div className={`text-[11px] font-semibold mt-1 ${p.color === "purple" ? "text-magic/70" : "text-brand/70"}`}>
                  ≈ ₪{(p.price / p.booklets).toFixed(0)} לחוברת
                </div>
              )}
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

        </div>{/* end scrollable content */}

        {/* Sticky payment section — always visible at bottom */}
        {sent ? (
          <div className="px-6 pb-6 pt-3 border-t border-ink/5 text-center space-y-3">
            <div className="text-4xl">💙</div>
            <p className="font-semibold text-ink">תשלחי {displayPrice} ₪ בביט למספר:</p>
            <p className="text-2xl font-bold text-brand tracking-widest">{BIT_PHONE}</p>
            <p className="text-sm text-ink/50">אחרי ששלחת — שלחי לנו וואטסאפ ונפעיל תוך שעה</p>
            <a
              href={`https://wa.me/${WA}?text=${encodeURIComponent(`שלום! שלחתי ${displayPrice} ₪ בביט לתוכנית ${plan.title}, אפשר להפעיל? 🙏`)}`}
              target="_blank" rel="noopener noreferrer"
              className="block w-full bg-[#25D366] text-white rounded-xl p-3 font-semibold text-sm hover:opacity-90 transition-opacity text-center"
            >
              💬 שלחי וואטסאפ לאישור
            </a>
            <button onClick={onClose} className="text-xs text-ink/40 underline hover:text-ink/60">סגור</button>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-3 border-t border-ink/5 space-y-3">
            <input
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="שם (אופציונלי)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              type="tel"
              inputMode="tel"
              className="w-full border border-ink/20 rounded-xl p-3 text-right bg-canvas/50 outline-none focus:border-magic text-sm"
              placeholder="טלפון לחזרה (אופציונלי) — נחזור אלייך"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />

            <p className="text-xs text-ink/40 font-medium text-center">בחרי אמצעי תשלום:</p>

            <button
              onClick={payWithBit}
              className="w-full bg-[#0095FF] text-white rounded-xl p-3.5 font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              <span className="text-lg">💙</span>
              <span>ביט — ₪{effectivePrice}{saleActive ? " (מבצע)" : ""}</span>
              <span className="text-white/60 text-xs font-normal mr-1">הכי פשוט</span>
            </button>

            <button
              onClick={sendWhatsApp}
              className="w-full border border-[#25D366] text-[#25D366] rounded-xl p-3 font-semibold text-sm hover:bg-[#25D366]/5 transition-colors flex items-center justify-center gap-2"
            >
              💬 תיצרי קשר בוואטסאפ
            </button>

            <p className="text-xs text-ink/30 text-center">
              ביטול בכל עת · פעילה תוך שעה{saleActive ? " · מחיר מיוחד לחודש ראשון" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
