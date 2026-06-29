import { useEffect, useState } from "react";
import { track } from "../hooks/useEvents";
import { IS_INAPP, IS_ANDROID, openExternal } from "../lib/inapp";

// Facebook/Instagram (and other apps) open links in their own in-app webview,
// which breaks streaming generation and caches aggressively. Since most paid
// traffic arrives this way, offer a one-tap escape to a real browser — where
// everything works perfectly.
export default function InAppBrowserBanner() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (IS_INAPP) track("inapp_browser_banner_shown", { android: IS_ANDROID }); }, []);
  if (!IS_INAPP || dismissed) return null;

  const openInBrowser = () => {
    track("inapp_open_in_browser_click", { android: IS_ANDROID });
    openExternal(window.location.href);
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-gradient-to-l from-magic to-brand text-white shadow-2xl" dir="rtl">
      <div className="relative px-4 py-3">
        <button
          onClick={() => setDismissed(true)}
          aria-label="סגור"
          className="absolute top-1.5 left-1.5 text-white/60 hover:text-white text-xl leading-none p-1"
        >×</button>
        <div className="flex items-center gap-3 pl-6">
          <span className="text-3xl flex-shrink-0 animate-bounce">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-extrabold leading-tight">
              פתחי בדפדפן לחוויה המלאה ✨
            </p>
            <p className="text-[11px] text-white/85 leading-snug mt-0.5">
              יצירה מהירה, <strong className="text-white">הדפסה ושמירת PDF</strong> עובדות מצוין רק בדפדפן (Chrome/Safari)
            </p>
          </div>
        </div>
        <button
          onClick={openInBrowser}
          className="mt-2.5 w-full bg-white text-magic text-sm font-display font-extrabold rounded-xl py-2.5 shadow-lg hover:bg-white/95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span>{IS_ANDROID ? "פתחי עכשיו ב-Chrome" : "פתחי עכשיו בדפדפן"}</span>
          <span className="text-base">←</span>
        </button>
      </div>
    </div>
  );
}
