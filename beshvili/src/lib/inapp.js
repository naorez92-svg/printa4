// Single source of truth for in-app-browser handling.
//
// Facebook / Instagram / WhatsApp etc. open links inside their own embedded
// webview. Two things break there: (1) streaming fetch (handled server-side via
// no-stream mode) and (2) window.print() — which simply does not exist in these
// webviews, so "save as PDF / print" silently does nothing. The only real fix
// for printing is to escape to the device's real browser.

const UA = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";

export const IS_INAPP = /FBAN|FBAV|FBIOS|FB_IAB|Instagram|Line\/|WhatsApp|MicroMessenger|Snapchat|Pinterest|TikTok|musical_ly|Twitter|Threads|GSA\/|; wv\)/i.test(UA);
export const IS_ANDROID = /Android/i.test(UA);

// Open `url` in the device's real browser, escaping the in-app webview.
// Android: an intent:// URL hands the link to Chrome. iOS in-app browsers give
// JS no reliable way to force Safari, so we copy the link and tell the user.
export function openExternal(url) {
  // A '#' fragment would collide with the intent:// "#Intent;..." delimiter, so drop it.
  const noHash = url.split("#")[0];
  if (IS_ANDROID) {
    const clean = noHash.replace(/^https?:\/\//, "");
    // browser_fallback_url: if Chrome isn't installed, Android opens the URL in
    // the default browser instead of dead-ending with "no app found".
    const fallback = encodeURIComponent(noHash);
    window.location.href = `intent://${clean}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
    return;
  }
  try { navigator.clipboard?.writeText(noHash); } catch { /* ignore */ }
  alert(`להדפסה ושמירת PDF צריך דפדפן רגיל 🌐\n\nהקישור הועתק — פתחי את Safari והדביקי אותו בשורת הכתובת:\n${noHash}`);
}
