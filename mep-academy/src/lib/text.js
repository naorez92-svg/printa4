// נרמול טקסט לחיפוש: גרשיים עבריים (״) ומרכאות מסולסלות מומרים למרכאות רגילות,
// ואותיות לטיניות מושוות ללא תלות ברישיות (nfpa ↔ NFPA).
export function normalize(s) {
  return s.replace(/[”“״]/g, '"').replace(/[׳']/g, "'").toLowerCase();
}
