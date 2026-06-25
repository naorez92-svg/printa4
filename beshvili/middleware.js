// Vercel Edge Middleware — injects dynamic OG tags for /b/:token when a social crawler visits.
// Regular users pass through unchanged and get the React SPA.

export const config = {
  matcher: "/b/:token*",
};

const CRAWLERS =
  /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|telegrambot|discordbot|slackbot|applebot|googlebot|bingbot/i;

const SUPABASE_URL = "https://gywpdzkvkdisonuzhsib.supabase.co";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function middleware(request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!CRAWLERS.test(ua)) return; // pass through to SPA for normal users

  const url = new URL(request.url);
  const token = url.pathname.replace(/^\/b\//, "").split("/")[0];
  if (!token) return;

  let title = "חוברת לימוד · בשבילי";
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/view-booklet?token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.title) title = `${data.title} · בשבילי`;
    }
  } catch {
    // use default title
  }

  const pageUrl = url.href;
  const origin = url.origin;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(pageUrl)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="חוברת לימוד AI מותאמת אישית — נוצרה עם בשבילי ✨">
  <meta property="og:image" content="${esc(origin)}/icon-512.png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:site_name" content="בשבילי">
  <meta name="twitter:card" content="summary">
  <meta http-equiv="refresh" content="0; url=${esc(pageUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
