const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const FONTS_RE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

// Strip unsafe content from AI-generated HTML before storing, rendering, or
// printing. This runs DOM-based (DOMParser) rather than regex: the browser's
// real HTML tokenizer correctly handles the bypasses a regex misses —
// `<img/src=x/onerror=...>` (slash separators), unclosed/malformed `<script`,
// `<iframe srcdoc=...>`, etc. It removes dangerous nodes/attributes but leaves
// all CSS (style blocks + inline styles) untouched, so booklet print layout is
// preserved exactly. The ONLY script allowed in the output is the trusted
// Tailwind CDN, re-injected at the end.
export function sanitizeBookletHtml(h) {
  if (!h) return h;
  if (typeof DOMParser === "undefined") return h; // non-browser — caller renders sandboxed anyway
  const hasTailwind = h.includes(TAILWIND_CDN);

  const doc = new DOMParser().parseFromString(h, "text/html");

  // 1. Remove executable / navigation / plugin / rebasing elements entirely.
  doc.querySelectorAll(
    "script, iframe, object, embed, applet, base, frame, frameset, noscript, template"
  ).forEach((el) => el.remove());

  // 2. Remove <meta http-equiv> (refresh redirects / CSP overrides).
  doc.querySelectorAll("meta[http-equiv]").forEach((el) => el.remove());

  // 3. Keep only Google-Fonts <link>; drop every other external stylesheet/resource.
  doc.querySelectorAll("link").forEach((el) => {
    if (!FONTS_RE.test(el.getAttribute("href") || "")) el.remove();
  });

  // 4. Scrub every element's attributes: event handlers + dangerous URL schemes.
  const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href", "background", "poster"]);
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const val = (attr.value || "").trim();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);                       // onclick/onerror/onload/…
      } else if (URL_ATTRS.has(name)) {
        // Browsers strip ASCII whitespace/control chars from URLs, so "java\tscript:"
        // executes as "javascript:". Normalize the same way before the scheme check
        // so that trick can't slip past.
        const scheme = val.toLowerCase().split("").filter((c) => c.charCodeAt(0) > 0x20).join("");
        const bad =
          /^(javascript|vbscript):/.test(scheme) ||
          // data:/blob: are script/navigation sinks — allow only raster image data URIs.
          // SVG data URIs (data:image/svg+xml) are excluded: they can carry inline scripts
          // and are not needed for AI-generated booklet content.
          (/^(data|blob):/.test(scheme) && !/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i.test(scheme));
        if (bad) {
          // For xlink:href (SVG namespaced attribute) removeAttribute("xlink:href") is a
          // no-op in standards-compliant browsers — must use the namespaced variant.
          if (name === "xlink:href") {
            el.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
          }
          el.removeAttribute(attr.name);
        }
      } else if (name === "srcdoc") {
        el.removeAttribute(attr.name);
      } else if (name === "style" &&
        // Test against a control-char-stripped copy so "java\tscript:" / "expression\t("
        // can't slip past, the same trick browsers normalize away.
        /(javascript|vbscript):|expression\s*\(/i.test(val.split("").filter((c) => c.charCodeAt(0) > 0x20 || c === " ").join(""))) {
        // The obfuscated form can't be reliably surgically cleaned (the control
        // chars defeat the replace), so drop the whole style — a style carrying
        // javascript:/expression() is never legitimate booklet layout anyway.
        el.removeAttribute(attr.name);
      }
    }
  });

  // 4.5 Scrub <style> blocks. AI-authored booklet CSS is normally safe, but the
  // print/"open in new tab" path renders this HTML in a NON-sandboxed same-origin
  // window, where a malicious @import or off-origin url() in a <style> block could
  // phone home (CSS exfiltration). Legitimate booklet CSS never does this — fonts
  // load via <link>, images via data: URIs — so strip ONLY those three constructs
  // and leave all layout/print/@page/@media CSS (and url(data:…)) byte-for-byte
  // intact. The off-origin url() rule anchors the scheme/`//` to the START of the
  // value so it cannot match a `//` that appears inside a base64 data: URI.
  doc.querySelectorAll("style").forEach((el) => {
    const css = el.textContent || "";
    const cleaned = css
      .replace(/@import[^;]*;?/gi, "")                              // external stylesheet load
      .replace(/expression\s*\(/gi, "blocked-expression(")          // legacy IE script-in-CSS
      .replace(/url\(\s*['"]?\s*(?:https?:\/\/|\/\/)[^)]*\)/gi, "url()"); // off-origin url() → inert
    if (cleaned !== css) el.textContent = cleaned;
  });

  // 5. Re-inject the single trusted script (Tailwind CDN) removed in step 1.
  if (hasTailwind && doc.head) {
    const s = doc.createElement("script");
    s.src = TAILWIND_CDN;
    doc.head.appendChild(s);
  }

  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}
