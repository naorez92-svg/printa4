// תרשימי SVG לשיעורים — פשוטים, נקיים ומותאמי RTL.
// כל תרשים מקבל aria-hidden כי הקריינות/כתוביות מתארות אותו מילולית.

const INK = "#20184A";
const MAGIC = "#6C5CE7";
const GROW = "#0E7C5F";
const BRAND = "#F4A02C";

function Box({ x, y, w, h, fill, text, textFill = "#fff", fontSize = 13 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} />
      <text
        x={x + w / 2}
        y={y + h / 2 + fontSize / 3}
        textAnchor="middle"
        fill={textFill}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="Assistant, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

function Arrow({ x1, y1, x2, y2 }) {
  return (
    <g stroke={INK} strokeWidth="2.5" opacity="0.5">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x2} cy={y2} r="3.5" fill={INK} stroke="none" />
    </g>
  );
}

export function MepCircleDiagram() {
  return (
    <svg viewBox="0 0 360 220" className="w-full max-w-md mx-auto" aria-hidden>
      <circle cx="180" cy="110" r="52" fill={INK} />
      <text x="180" y="105" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800" fontFamily="Rubik, sans-serif">MEP</text>
      <text x="180" y="126" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="Assistant, sans-serif">הלב של הבניין</text>
      <Box x={10} y={20} w={100} h={44} fill={MAGIC} text="M · מיזוג ואוורור" fontSize={12} />
      <Box x={250} y={20} w={100} h={44} fill={BRAND} text="E · חשמל" fontSize={12} />
      <Box x={130} y={165} w={100} h={44} fill={GROW} text="P · אינסטלציה" fontSize={12} />
      <Arrow x1={110} y1={50} x2={140} y2={80} />
      <Arrow x1={250} y1={50} x2={220} y2={80} />
      <Arrow x1={180} y1={162} x2={180} y2={165} />
    </svg>
  );
}

export function ChainDiagram() {
  return (
    <svg viewBox="0 0 360 250" className="w-full max-w-md mx-auto" aria-hidden>
      <Box x={120} y={8} w={120} h={38} fill={INK} text="יזם / מזמין" />
      <Box x={20} y={72} w={150} h={38} fill={MAGIC} text="מתכננים ויועצים" fontSize={12} />
      <Box x={190} y={72} w={150} h={38} fill={MAGIC} text="מנהל פרויקט" fontSize={12} />
      <Box x={105} y={136} w={150} h={38} fill={BRAND} text="מפקח" />
      <Box x={105} y={200} w={150} h={38} fill={GROW} text="קבלן ראשי + משנה" fontSize={12} />
      <Arrow x1={150} y1={46} x2={95} y2={72} />
      <Arrow x1={210} y1={46} x2={265} y2={72} />
      <Arrow x1={180} y1={110} x2={180} y2={136} />
      <Arrow x1={180} y1={174} x2={180} y2={200} />
    </svg>
  );
}

export function LifecycleDiagram() {
  const stages = ["תכנון", "התקנה", "הרצה", "מסירה", "בדק", "תחזוקה"];
  const colors = [MAGIC, MAGIC, BRAND, BRAND, GROW, GROW];
  return (
    <svg viewBox="0 0 360 120" className="w-full max-w-md mx-auto" aria-hidden>
      {stages.map((s, i) => (
        <g key={s}>
          {/* RTL: מתחילים מימין */}
          <Box x={360 - (i + 1) * 58 + 4} y={40} w={50} h={40} fill={colors[i]} text={s} fontSize={11} />
          {i < stages.length - 1 && (
            <Arrow x1={360 - (i + 1) * 58 + 2} y1={60} x2={360 - (i + 1) * 58 - 2} y2={60} />
          )}
        </g>
      ))}
      <text x="180" y="110" textAnchor="middle" fill={INK} opacity="0.6" fontSize="11" fontFamily="Assistant, sans-serif">
        החלטות התכנון חיות 25 שנה קדימה
      </text>
    </svg>
  );
}

export function TwoSidesDiagram() {
  return (
    <svg viewBox="0 0 360 250" className="w-full max-w-md mx-auto" aria-hidden>
      <text x="270" y="22" textAnchor="middle" fill={INK} fontSize="14" fontWeight="800" fontFamily="Assistant, sans-serif">צד המזמין 💰</text>
      <text x="90" y="22" textAnchor="middle" fill={INK} fontSize="14" fontWeight="800" fontFamily="Assistant, sans-serif">צד הקבלן 🏗️</text>
      <line x1="180" y1="10" x2="180" y2="240" stroke={INK} strokeWidth="2" strokeDasharray="6 6" opacity="0.35" />
      <Box x={200} y={38} w={140} h={34} fill={INK} text="יזם" fontSize={12} />
      <Box x={200} y={82} w={140} h={34} fill={MAGIC} text="מנהל פרויקט (מזמין)" fontSize={11} />
      <Box x={200} y={126} w={140} h={34} fill={MAGIC} text="מתכננים ויועצים" fontSize={11} />
      <Box x={200} y={170} w={140} h={34} fill={BRAND} text="מפקח" fontSize={12} />
      <Box x={20} y={38} w={140} h={34} fill={INK} text="קבלן ראשי" fontSize={12} />
      <Box x={20} y={82} w={140} h={34} fill={MAGIC} text="מנהל פרויקט (קבלן)" fontSize={11} />
      <Box x={20} y={126} w={140} h={34} fill={GROW} text="מנהל עבודה ⚖️" fontSize={11} />
      <Box x={20} y={170} w={140} h={34} fill={BRAND} text="מהנדס מערכות MEP" fontSize={11} />
      <Box x={20} y={214} w={140} h={28} fill="#8892b0" text="קבלני משנה" fontSize={11} />
    </svg>
  );
}

export function FeedChainDiagram() {
  const stages = [
    { t: "חח\"י", c: INK },
    { t: "מונה", c: MAGIC },
    { t: "לוח ראשי", c: MAGIC },
    { t: "לוח קומתי", c: BRAND },
    { t: "מעגלים", c: GROW },
  ];
  return (
    <svg viewBox="0 0 360 130" className="w-full max-w-md mx-auto" aria-hidden>
      {stages.map((s, i) => (
        <g key={s.t}>
          <Box x={360 - (i + 1) * 70 + 6} y={30} w={60} h={42} fill={s.c} text={s.t} fontSize={11} />
          {i < stages.length - 1 && (
            <Arrow x1={360 - (i + 1) * 70 + 4} y1={51} x2={360 - (i + 1) * 70 - 2} y2={51} />
          )}
        </g>
      ))}
      <text x="180" y="100" textAnchor="middle" fill={INK} opacity="0.6" fontSize="11" fontFamily="Assistant, sans-serif">
        ⚡ כל רמה מוגנת בנפרד: מפסק ראשי → מא"זים → פחת
      </text>
    </svg>
  );
}

export const DIAGRAMS = {
  "mep-circle": MepCircleDiagram,
  chain: ChainDiagram,
  lifecycle: LifecycleDiagram,
  "two-sides": TwoSidesDiagram,
  "feed-chain": FeedChainDiagram,
};
