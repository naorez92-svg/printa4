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

// ---- תרשימי זרימה מונפשים ----
// צבעי מוסכמה: כחול = מים קרים, כתום = מים חמים/מעובים, תכלת = אוויר, סגול = קרר

const CHILLED = "#2563EB";
const HOT = "#EA580C";
const AIR = "#0EA5E9";
const REFRIG = "#9333EA";

function Pipe({ d, color, width = 4 }) {
  return (
    <g fill="none">
      <path d={d} stroke={color} strokeWidth={width} opacity="0.25" />
      <path className="flow-pipe" d={d} stroke={color} strokeWidth={width} strokeDasharray="8 8" strokeLinecap="round" />
    </g>
  );
}

function Label({ x, y, text, fill = INK, size = 11, anchor = "middle" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={size} fontWeight="700" fontFamily="Assistant, sans-serif">
      {text}
    </text>
  );
}

export function AhuFlowDiagram() {
  return (
    <svg viewBox="0 0 360 200" className="w-full max-w-md mx-auto" aria-hidden>
      {/* גוף היט"א */}
      <rect x="90" y="60" width="180" height="80" rx="10" fill="#EEF0F7" stroke={INK} strokeWidth="2" />
      <Label x={180} y={52} text='יט"א — יחידת טיפול באוויר' size={13} />
      {/* מסנן, סוללה, מפוח */}
      <rect x="230" y="72" width="14" height="56" fill="#94A3B8" rx="2" />
      <Label x={237} y={158} text="מסנן" size={10} />
      <rect x="180" y="72" width="20" height="56" fill={CHILLED} rx="2" opacity="0.85" />
      <Label x={190} y={158} text="סוללת קירור" size={10} />
      <circle cx="130" cy="100" r="20" fill={MAGIC} />
      <Label x={130} y={104} text="מפוח" fill="#fff" size={10} />
      {/* אוויר: חוזר + צח נכנסים מימין, מסופק יוצא שמאלה */}
      <Pipe d="M 350 85 H 272" color={AIR} width={6} />
      <Label x={330} y={76} text="אוויר חוזר 🔁" size={10} />
      <Pipe d="M 350 118 H 272" color={AIR} width={6} />
      <Label x={330} y={136} text="אוויר צח 🌱" size={10} />
      <Pipe d="M 108 100 H 10" color={AIR} width={7} />
      <Label x={45} y={88} text="אוויר קר לחללים ❄️" size={10} />
      {/* מים קרים אל הסוללה וממנה */}
      <Pipe d="M 185 145 V 190" color={CHILLED} />
      <Pipe d="M 197 190 V 145" color={HOT} />
      <Label x={191} y={199} text="מים קרים נכנסים · חוזרים חמים" size={9} />
    </svg>
  );
}

export function ChillerCycleDiagram() {
  return (
    <svg viewBox="0 0 360 230" className="w-full max-w-md mx-auto" aria-hidden>
      <Label x={180} y={16} text="הצ'ילר — המפעל לייצור קור" size={13} />
      {/* ארבעת הרכיבים במעגל */}
      <Box x={240} y={30} w={100} h={38} fill={HOT} text="מעבה 🔥" fontSize={12} />
      <Box x={240} y={160} w={100} h={38} fill={MAGIC} text="מדחס" fontSize={12} />
      <Box x={20} y={160} w={100} h={38} fill={CHILLED} text="מאייד ❄️" fontSize={12} />
      <Box x={20} y={30} w={100} h={38} fill={INK} text="שסתום התפשטות" fontSize={10} />
      {/* מעגל הקרר (סגול) */}
      <Pipe d="M 290 68 V 160" color={REFRIG} />
      <Pipe d="M 240 179 H 120" color={REFRIG} />
      <Pipe d="M 70 160 V 68" color={REFRIG} />
      <Pipe d="M 120 49 H 240" color={REFRIG} />
      <Label x={180} y={100} text="מעגל הקרר" fill={REFRIG} size={11} />
      {/* מים קרים דרך המאייד */}
      <Pipe d="M 0 195 H 70 V 198" color={CHILLED} />
      <Label x={40} y={215} text='מים קרים ליט"אות 7°' size={9} />
      {/* מים מעובים דרך המעבה */}
      <Pipe d="M 290 30 V 5 H 360" color={HOT} />
      <Label x={325} y={22} text="מים מעובים למגדל" size={9} />
    </svg>
  );
}

export function CoolingTowerDiagram() {
  return (
    <svg viewBox="0 0 360 220" className="w-full max-w-md mx-auto" aria-hidden>
      <Label x={180} y={16} text="מגדל הקירור — משחרר את החום לשמיים" size={12} />
      {/* גוף המגדל */}
      <path d="M 120 190 L 135 60 H 225 L 240 190 Z" fill="#EEF0F7" stroke={INK} strokeWidth="2" />
      {/* מפוח למעלה */}
      <circle cx="180" cy="60" r="22" fill={MAGIC} />
      <Label x={180} y={64} text="מפוח" fill="#fff" size={10} />
      {/* אדים עולים */}
      <Pipe d="M 165 34 V 6" color={AIR} width={3} />
      <Pipe d="M 180 34 V 2" color={AIR} width={3} />
      <Pipe d="M 195 34 V 6" color={AIR} width={3} />
      <Label x={250} y={14} text="אידוי 💨" size={11} anchor="start" />
      {/* מים חמים נכנסים, מרוססים, קרים יוצאים */}
      <Pipe d="M 340 95 H 232" color={HOT} />
      <Label x={300} y={86} text="מים חמים מהצ'ילר" size={9} />
      <Pipe d="M 160 110 V 150 M 180 110 V 150 M 200 110 V 150" color={AIR} width={2} />
      <Label x={180} y={172} text="טיפות נופלות ומתקררות" size={9} />
      <Pipe d="M 128 185 H 20" color={CHILLED} />
      <Label x={60} y={205} text="מים קרירים חוזרים לצ'ילר" size={9} />
    </svg>
  );
}

export function FullSystemDiagram() {
  return (
    <svg viewBox="0 0 360 260" className="w-full max-w-md mx-auto" aria-hidden>
      {/* חתך בניין */}
      <rect x="70" y="40" width="220" height="200" fill="#EEF0F7" stroke={INK} strokeWidth="2" rx="6" />
      <line x1="70" y1="105" x2="290" y2="105" stroke={INK} opacity="0.3" />
      <line x1="70" y1="170" x2="290" y2="170" stroke={INK} opacity="0.3" />
      {/* גג: מגדל קירור */}
      <Box x={110} y={8} w={90} h={28} fill={HOT} text="מגדל קירור" fontSize={10} />
      {/* קומות: יט"אות */}
      <Box x={210} y={62} w={64} h={28} fill={AIR} text='יט"א' fontSize={10} />
      <Box x={210} y={127} w={64} h={28} fill={AIR} text='יט"א' fontSize={10} />
      {/* מרתף: צ'ילר ומשאבות */}
      <Box x={90} y={196} w={80} h={30} fill={MAGIC} text="צ'ילר" fontSize={11} />
      <Box x={185} y={196} w={80} h={30} fill={GROW} text="משאבות" fontSize={10} />
      {/* מעגל מים מעובים: צ'ילר ↔ מגדל */}
      <Pipe d="M 118 196 V 36" color={HOT} />
      <Label x={100} y={120} text="מעובים" fill={HOT} size={9} />
      {/* מעגל מים קרים: משאבות → יט"אות */}
      <Pipe d="M 242 196 V 90 H 250" color={CHILLED} />
      <Label x={258} y={110} text="מים קרים" fill={CHILLED} size={9} anchor="start" />
      {/* אוויר קר מהיט"א לחלל */}
      <Pipe d="M 210 76 H 150" color={AIR} width={3} />
      <Pipe d="M 210 141 H 150" color={AIR} width={3} />
      <Label x={40} y={150} text="4 מערכות · מעגל אחד" size={10} anchor="start" />
    </svg>
  );
}

export function SprinklerFlowDiagram() {
  return (
    <svg viewBox="0 0 360 200" className="w-full max-w-md mx-auto" aria-hidden>
      <Label x={180} y={16} text="מערכת המתזים — מהמקור ועד הראש" size={12} />
      <Box x={280} y={40} w={70} h={34} fill={CHILLED} text="מקור מים" fontSize={10} />
      <Box x={190} y={40} w={70} h={34} fill={MAGIC} text="משאבות" fontSize={10} />
      <Box x={100} y={40} w={70} h={34} fill={INK} text="ברז ראשי ICV" fontSize={9} />
      <Pipe d="M 280 57 H 260" color={CHILLED} />
      <Pipe d="M 190 57 H 170" color={CHILLED} />
      {/* קו עולה וראשים */}
      <Pipe d="M 135 74 V 120 H 40" color={CHILLED} />
      <Pipe d="M 300 120 H 135" color={CHILLED} />
      {[70, 130, 200, 270].map((x) => (
        <g key={x}>
          <line x1={x} y1="120" x2={x} y2="136" stroke={CHILLED} strokeWidth="3" />
          <circle cx={x} cy="140" r="5" fill={x === 130 ? HOT : "#94A3B8"} />
        </g>
      ))}
      {/* ראש אחד נפתח */}
      <Pipe d="M 124 150 L 118 168 M 130 150 V 170 M 136 150 L 142 168" color={AIR} width={2} />
      <Label x={130} y={188} text="רק הראש שהתחמם נפתח 🔥" size={10} />
    </svg>
  );
}

export function WaterFlowDiagram() {
  return (
    <svg viewBox="0 0 360 230" className="w-full max-w-md mx-auto" aria-hidden>
      <Label x={180} y={14} text="מים עולים בלחץ · ביוב יורד בגרביטציה" size={12} />
      {/* בניין */}
      <rect x="110" y="30" width="140" height="190" fill="#EEF0F7" stroke={INK} strokeWidth="2" rx="6" />
      <line x1="110" y1="93" x2="250" y2="93" stroke={INK} opacity="0.3" />
      <line x1="110" y1="156" x2="250" y2="156" stroke={INK} opacity="0.3" />
      {/* אספקת מים: עירוני → מד → בוסטר → עולה */}
      <Box x={10} y={185} w={60} h={30} fill={CHILLED} text="עירוני" fontSize={10} />
      <Pipe d="M 70 200 H 128" color={CHILLED} />
      <Label x={95} y={193} text="מד מים" size={9} />
      <Pipe d="M 135 200 V 45" color={CHILLED} />
      <Label x={150} y={60} text="קו עולה" fill={CHILLED} size={9} anchor="start" />
      {/* ביוב יורד + אוורור לגג */}
      <Pipe d="M 225 55 V 218" color={HOT} />
      <Pipe d="M 225 45 V 22" color={AIR} width={3} />
      <Label x={240} y={30} text="אוורור לגג 🌬️" size={9} anchor="start" />
      <Pipe d="M 225 218 H 320" color={HOT} />
      <Label x={290} y={210} text="לביוב העירוני" size={9} />
      <Label x={205} y={130} text="קולטן" fill={HOT} size={9} />
    </svg>
  );
}

export function MatrixFlowDiagram() {
  return (
    <svg viewBox="0 0 360 220" className="w-full max-w-md mx-auto" aria-hidden>
      <Label x={180} y={16} text="גלאי אחד מזהה — הרכזת מפעילה הכול" size={12} />
      <Box x={140} y={90} w={80} h={40} fill={HOT} text="רכזת אש 🚨" fontSize={11} />
      <Box x={20} y={30} w={90} h={30} fill={INK} text="כריזת חירום" fontSize={10} />
      <Box x={250} y={30} w={90} h={30} fill={INK} text="מעליות ⬇ לקרקע" fontSize={9} />
      <Box x={20} y={160} w={90} h={30} fill={INK} text="מדפי אש נסגרים" fontSize={9} />
      <Box x={250} y={160} w={90} h={30} fill={INK} text="מפוחי עשן" fontSize={10} />
      <Pipe d="M 148 95 L 100 60" color={HOT} width={3} />
      <Pipe d="M 212 95 L 260 60" color={HOT} width={3} />
      <Pipe d="M 148 125 L 100 160" color={HOT} width={3} />
      <Pipe d="M 212 125 L 260 160" color={HOT} width={3} />
      <Label x={180} y={150} text="גלאי 🔎" size={11} />
      <Pipe d="M 180 160 V 130" color={AIR} width={3} />
      <Label x={180} y={210} text="מטריצת ההפעלות — הכול אוטומטי, בשניות" size={10} />
    </svg>
  );
}

export const DIAGRAMS = {
  "mep-circle": MepCircleDiagram,
  chain: ChainDiagram,
  lifecycle: LifecycleDiagram,
  "two-sides": TwoSidesDiagram,
  "feed-chain": FeedChainDiagram,
  "ahu-flow": AhuFlowDiagram,
  "chiller-cycle": ChillerCycleDiagram,
  "cooling-tower": CoolingTowerDiagram,
  "full-system": FullSystemDiagram,
  "sprinkler-flow": SprinklerFlowDiagram,
  "water-flow": WaterFlowDiagram,
  "matrix-flow": MatrixFlowDiagram,
};
