import { useEffect, useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { track } from "../hooks/useEvents";

// Dedupe "prompt shown" per variant across re-renders/remounts within a page load.
const promptShownVariants = new Set();

export default function InstallPWA({ variant = "banner" }) {
  const { canInstall, isIOS, install } = useInstallPrompt();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed]      = useState(() => {
    try { return localStorage.getItem("beshvili_pwa_dismissed") === "1"; } catch { return false; }
  });

  const visible = canInstall && !dismissed;

  useEffect(() => {
    if (visible && !promptShownVariants.has(variant)) {
      promptShownVariants.add(variant);
      track("pwa_prompt_shown", { variant, isIOS });
    }
  }, [visible, variant, isIOS]);

  if (!visible) return null;

  const handleInstall = async () => {
    track("pwa_install_clicked", { variant, isIOS });
    if (isIOS) { setShowIOSModal(true); track("pwa_ios_instructions_shown", { variant }); return; }
    const accepted = await install();
    if (accepted) { track("pwa_install_accepted", { variant }); setDismissed(true); }
    else { track("pwa_install_dismissed", { variant, via: "decline" }); }
  };

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleInstall}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/8 transition-all text-right"
      >
        <span className="text-base">📲</span>
        <span>הורד כאפליקציה</span>
      </button>
    );
  }

  // Default: floating bottom banner (mobile)
  return (
    <>
      <div className="fixed bottom-4 inset-x-4 z-50 flex items-center gap-3 bg-ink text-white rounded-2xl shadow-2xl px-4 py-3 lg:hidden">
        <span className="text-2xl flex-shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold font-display leading-tight">הורד כאפליקציה</p>
          <p className="text-xs text-white/50 mt-0.5">גישה מהירה מהמסך הראשי</p>
        </div>
        <button
          onClick={handleInstall}
          className="flex-shrink-0 bg-brand text-ink text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-brand/90 transition-colors"
        >
          {isIOS ? "איך?" : "התקן"}
        </button>
        <button
          onClick={() => { track("pwa_install_dismissed", { variant, via: "close-x" }); try { localStorage.setItem("beshvili_pwa_dismissed", "1"); } catch {} setDismissed(true); }}
          className="flex-shrink-0 text-white/30 hover:text-white/60 text-lg leading-none px-1"
          aria-label="סגור"
        >
          ×
        </button>
      </div>

      {showIOSModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white rounded-t-3xl px-6 pt-5 pb-8 w-full max-w-sm text-center"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-5" />
            <p className="text-4xl mb-3">📱</p>
            <h2 className="text-xl font-bold text-ink font-display mb-1">הוסף למסך הבית</h2>
            <p className="text-sm text-ink/50 mb-6">כך תוכל לפתוח את בשבילי כמו אפליקציה אמיתית</p>

            <ol className="text-right space-y-4 mb-6">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-magic text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <span className="text-sm text-ink/70">
                  לחץ על כפתור <strong className="text-ink">השיתוף</strong>{" "}
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-ink/10 rounded text-base leading-none">⬆️</span>{" "}
                  בתחתית הדפדפן
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-magic text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <span className="text-sm text-ink/70">
                  גלול למטה ובחר <strong className="text-ink">"הוסף למסך הבית"</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-magic text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <span className="text-sm text-ink/70">לחץ <strong className="text-ink">"הוסף"</strong> ובשבילי תופיע על המסך שלך</span>
              </li>
            </ol>

            <button
              onClick={() => { track("pwa_install_dismissed", { variant, via: "ios-modal-done" }); setShowIOSModal(false); try { localStorage.setItem("beshvili_pwa_dismissed", "1"); } catch {} setDismissed(true); }}
              className="w-full bg-ink text-white py-3 rounded-2xl font-bold text-sm"
            >
              הבנתי, תודה!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
