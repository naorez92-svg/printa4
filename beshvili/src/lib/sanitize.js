const TAILWIND_CDN = "https://cdn.tailwindcss.com";

// Strip unsafe content from AI-generated HTML before storing or rendering.
export function sanitizeBookletHtml(h) {
  if (!h) return h;
  const hasTailwind = h.includes(TAILWIND_CDN);

  // 1. Remove all <script> blocks (inline and external)
  let out = h.replace(/<script\b[\s\S]*?<\/script>/gi, "");

  // 2. Remove tags that can redirect, load plugins, or rebase relative URLs
  out = out.replace(/<(base|frame|frameset)\b[^>]*\/?>/gi, "");
  out = out.replace(/<meta\b[^>]*\bhttp-equiv\b[^>]*\/?>/gi, "");
  out = out.replace(/<(object|applet)\b[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<(object|applet|embed)\b[^>]*\/?>/gi, "");

  // 3. Strip <link> tags that load external resources; Google Fonts are safe and
  //    required for booklet typography (Fredoka, Varela Round, Assistant, Rubik)
  out = out.replace(/<link\b[^>]*>/gi, (m) =>
    /https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(m) ? m : ""
  );

  // 4. Remove inline event-handler attributes (onclick, onerror, onload, …)
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // 5. Strip javascript:/vbscript: from href, src, action, formaction attributes
  out = out.replace(
    /((?:href|src|action|formaction)\s*=\s*["'])\s*(?:javascript|vbscript):[^"']*/gi,
    "$1#"
  );

  // 6. Strip javascript:/vbscript: from inline style attribute values
  //    Covers: background:url(javascript:...), content:url(javascript:...), etc.
  out = out.replace(/\bstyle\s*=\s*"([^"]*)"/gi, (_, v) =>
    `style="${v.replace(/(?:javascript|vbscript):/gi, "")}"`
  );
  out = out.replace(/\bstyle\s*=\s*'([^']*)'/gi, (_, v) =>
    `style='${v.replace(/(?:javascript|vbscript):/gi, "")}'`
  );

  // 7. Re-inject Tailwind CDN (was removed in step 1 along with all scripts)
  if (hasTailwind) {
    const tag = `<script src="${TAILWIND_CDN}"></script>`;
    out = out.includes("</head>")
      ? out.replace("</head>", `${tag}\n</head>`)
      : tag + out;
  }

  return out;
}
