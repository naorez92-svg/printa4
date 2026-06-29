import { useEffect, useState } from "react";
import { track } from "../hooks/useEvents";

// Facebook/Instagram (and other apps) open links in their own in-app webview,
// which breaks streaming generation and caches aggressively. Since most paid
// traffic arrives this way, offer a one-tap escape to a real browser — where
// everything works perfectly.
const UA = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
const IS_INAPP = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|Snapchat|Pinterest|TikTok|musical_ly|; wv\)/i.test(UA);
const IS_ANDROID = /Android/i.test(UA);

export default function InAppBrowserBanner() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (IS_INAPP) track("inapp_browser_banner_shown", { android: IS_ANDROID }); }, []);
  if (!IS_INAPP || dismissed) return null;

  const openInBrowser = () => {
    track("inapp_open_in_browser_click", { android: IS_ANDROID });
    const url = window.location.href;
    if (IS_ANDROID) {
      // Force-open Chrome on Android via an intent URL.
      const clean = url.replace(/^https?:\/\//, "");
      window.location.href = `intent://${clean}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      try { navigator.clipboard?.writeText(url); } catch { /* ignore */ }
      alert("הקישור הועתק! 📋\nפתחי את Safari והדביקי אותו בשורת הכתובת — או לחצי על הכפתור ⋯ למעלה ← \"פתח בדפדפן\".");
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-ink text-white px-3 py-2.5 flex items-center gap-2 shadow-lg" dir="rtl">
      <span className="text-lg flex-shrink-0">🌐</span>
      <p className="flex-1 text-[11px] leading-snug">
        נכנסת מתוך פייסבוק — <strong>לחוויה מלאה ויצירת חוברות שתמיד עובדת, פתחי בדפדפן 👆</strong>
      </p>
      <button
        onClick={openInBrowser}
        className="flex-shrink-0 bg-brand text-white text-xs font-bold rounded-xl px-3 py-1.5 hover:opacity-90 transition-opacity"
      >
        {IS_ANDROID ? "פתח ב-Chrome" : "פתח בדפדפן"}
      </button>
      <button onClick={() => setDismissed(true)} aria-label="סגור" className="flex-shrink-0 text-white/50 hover:text-white text-lg leading-none px-1">×</button>
    </div>
  );
}
