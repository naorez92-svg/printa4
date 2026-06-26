const TAILWIND_CDN = "https://cdn.tailwindcss.com";

// Strip unsafe content from AI-generated HTML before storing or rendering.
// Removes all <script> blocks, event-handler attributes, and javascript: URLs,
// then restores the Tailwind CDN script which is required for booklet styling.
export function sanitizeBookletHtml(h) {
  if (!h) return h;
  const hasTailwind = h.includes(TAILWIND_CDN);
  // Remove every <script> block (inline and external)
  let out = h.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  // Remove dangerous inline event handlers (onerror, onload, onclick, …)
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Strip javascript: protocol from href, src, action, formaction attributes
  out = out.replace(/((?:href|src|action|formaction)\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#");
  // Re-inject the Tailwind CDN (safe, stripped above along with all scripts)
  if (hasTailwind) {
    const tag = `<script src="${TAILWIND_CDN}"></script>`;
    out = out.includes("</head>")
      ? out.replace("</head>", `${tag}\n</head>`)
      : tag + out;
  }
  return out;
}
