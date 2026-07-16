// Shared print-HTML builder — used by BOTH the in-app Preview and the public
// share page (/b/:token). Keeping it in one place means every print fix
// (blank trailing page, Jewish flow layout, feedback QR) applies to shared
// links too, not just the owner's preview.

export function buildPrintHtml(html, shareToken) {
  let h = html.includes("@page")
    ? html
    : html.replace(
        "</head>",
        "<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style></head>"
      );
  // The generator often emits page-break-after on EVERY .page including the
  // last one — printing then appends a blank trailing sheet. Neutralize the
  // break on the last page; body margins are another blank-page source.
  const lastPageFix =
    '<style id="bsv-last-page-fix">@media print{' +
    '.page:last-of-type,.page:last-child{page-break-after:auto!important;break-after:auto!important}' +
    'body{margin:0!important;padding:0!important}' +
    '}</style>';
  if (!h.includes("bsv-last-page-fix")) {
    h = h.includes("</head>") ? h.replace("</head>", lastPageFix + "</head>") : lastPageFix + h;
  }
  // The feedback loop: a small print-only QR pinned to the bottom-left corner
  // of every printed sheet, linking to /f/{share_token} — whoever holds the
  // page scans and reports how it went in 10 seconds.
  if (shareToken && !h.includes("bsv-feedback-qr")) {
    const fUrl = `${window.location.origin}/f/${shareToken}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=1&data=${encodeURIComponent(fUrl)}`;
    const qrBlock =
      '<div id="bsv-feedback-qr" style="display:none">' +
        `<img src="${qrImg}" alt="" style="width:13mm;height:13mm;display:block"/>` +
        '<span style="font-size:6.5px;color:#9ca3af;display:block;text-align:center;line-height:1.25;margin-top:0.5mm">סרקו —<br/>איך הלך?</span>' +
      '</div>' +
      '<style>@media print{#bsv-feedback-qr{display:block!important;position:fixed;bottom:4mm;left:5mm;z-index:9999;width:14mm}}</style>';
    // Inject at the START of <body>, never the end: appended trailing elements
    // break the generator's `.page:last-child{page-break-after:avoid}` rule and
    // print gains a blank final sheet. Position:fixed renders it regardless.
    h = /<body[^>]*>/i.test(h) ? h.replace(/(<body[^>]*>)/i, `$1${qrBlock}`) : qrBlock + h;
  }
  // Flow-type worksheets (e.g. Jewish-studies materials) lay each page out with
  // `.page{min-height:296mm}`. When a page's content is taller than A4 it overflows
  // onto a second physical sheet, leaving a big gap and an awkward mid-content split
  // in the saved PDF. For those ONLY, let the content flow and fill each sheet.
  // Magazine booklets use fixed `height` + `overflow:hidden` and are untouched.
  if (/\.page\s*\{[^}]*\bmin-height\s*:/i.test(h)) {
    const flow =
      '<style id="bsv-print-flow">@media print{' +
      // Reserve a 20mm bottom band on every sheet for the pinned attribution footer.
      '@page{size:A4;margin:12mm 12mm 20mm 12mm}' +
      // width:auto — the generator's fixed 210mm exceeds the 186mm printable
      // width once margins apply, clipping ~24mm off every sheet (RTL: right side).
      '.page{width:auto!important;max-width:100%!important;min-height:0!important;height:auto!important;padding:0!important;margin:0!important;box-shadow:none!important;page-break-after:auto!important}' +
      '.q-row,table,tr,thead,tbody,.info-box,.rule-box,blockquote,.header-bar,.checkbox-row{break-inside:avoid!important;page-break-inside:avoid!important}' +
      '.section-title{break-after:avoid!important;page-break-after:avoid!important}' +
      // The attribution footer is absolutely-positioned on the last page; once
      // page height is auto, `bottom` floats mid-content — pin it per sheet.
      '.page div[style*="bottom:4mm"]{position:fixed!important;bottom:5mm!important;left:0!important;right:0!important}' +
      '}</style>';
    h = h.includes("</head>") ? h.replace("</head>", flow + "</head>") : flow + h;
  }
  return h;
}
