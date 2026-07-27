import { useEffect, useRef, useState } from "react";
import { useModal } from "../lib/useModal.js";

// תעודת סיום — מצוירת על קנבס בצד הלקוח (חינם, אופליין, בלי שרת).
// זמינה כשכל המודולים הושלמו והציון במבחן 90% ומעלה ("מפקח בכיר").

const W = 1200;
const H = 850;

function drawCertificate(canvas, { name, score, date }) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // רקע ומסגרת כפולה בצבעי המותג
  ctx.fillStyle = "#F7F6FB";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#20184A";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = "#F4A02C";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#20184A";

  ctx.font = "64px serif";
  ctx.fillText("⚙️", W / 2, 150);

  ctx.font = "bold 44px Assistant, sans-serif";
  ctx.fillText("אקדמיית MEP", W / 2, 220);

  ctx.fillStyle = "#6C5CE7";
  ctx.font = "bold 72px Assistant, sans-serif";
  ctx.fillText("תעודת סיום", W / 2, 320);

  ctx.fillStyle = "#20184A";
  ctx.font = "32px Assistant, sans-serif";
  ctx.fillText("מוענקת בזאת ל־", W / 2, 400);

  ctx.font = "bold 56px Assistant, sans-serif";
  ctx.fillText(name || "________", W / 2, 480);

  ctx.font = "30px Assistant, sans-serif";
  ctx.fillText("על השלמת הקורס הדיגיטלי למערכות אלקטרומכניות בבנייה", W / 2, 550);
  ctx.fillText("חשמל · מיזוג · אינסטלציה · בטיחות אש · מעליות · גז · טופס 4", W / 2, 598);

  ctx.fillStyle = "#0E7C5F";
  ctx.font = "bold 40px Assistant, sans-serif";
  ctx.fillText(`ציון גמר: ${score}% — רמת מפקח בכיר`, W / 2, 680);

  ctx.fillStyle = "#20184A";
  ctx.font = "26px Assistant, sans-serif";
  ctx.fillText(date, W / 2, 745);

  ctx.fillStyle = "rgba(32, 24, 74, 0.55)";
  ctx.font = "18px Assistant, sans-serif";
  ctx.fillText("תעודה זו מעידה על השלמת לימוד עצמי — אינה הסמכה רשמית", W / 2, 790);
}

export default function Certificate({ session, bestExam, onClose }) {
  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const [name, setName] = useState(() => {
    const email = session?.user?.email || "";
    return email.split("@")[0].replace(/[._-]+/g, " ");
  });
  const [dataUrl, setDataUrl] = useState("");
  useModal(dialogRef);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // מציירים אחרי שהגופן העברי נטען — אחרת הקנבס מצויר בגופן ברירת מחדל
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled || !canvasRef.current) return;
      drawCertificate(canvasRef.current, {
        name: name.trim(),
        score: bestExam,
        date: new Date().toLocaleDateString("he-IL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      });
      setDataUrl(canvasRef.current.toDataURL("image/png"));
    };
    if (document.fonts?.ready) document.fonts.ready.then(draw);
    else draw();
    return () => {
      cancelled = true;
    };
  }, [name, bestExam]);

  const shareText = encodeURIComponent(
    `🎓 סיימתי את קורס אקדמיית MEP — מערכות אלקטרומכניות בבנייה — בציון ${bestExam}%! ${window.location.origin}`
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="תעודת סיום"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-xl">🎓 תעודת הסיום שלך</h1>
          <button
            onClick={onClose}
            className="rounded-xl bg-canvas hover:bg-ink/10 px-3 py-1.5 font-bold"
          >
            ✕<span className="sr-only">סגירה</span>
          </button>
        </div>

        <label className="block">
          <span className="text-sm font-semibold">השם שיופיע על התעודה</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-2xl border border-ink/15 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-magic"
          />
        </label>

        <canvas ref={canvasRef} width={W} height={H} className="hidden" aria-hidden />
        {dataUrl && (
          <img
            src={dataUrl}
            alt={`תעודת סיום על שם ${name.trim() || "ללא שם"} בציון ${bestExam}%`}
            className="w-full rounded-xl border border-ink/10 shadow-sm"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <a
            href={dataUrl}
            download="mep-academy-certificate.png"
            className="bg-magic text-white rounded-2xl py-3 font-bold text-center hover:opacity-90"
          >
            ⬇️ הורדת התעודה
          </a>
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-grow text-white rounded-2xl py-3 font-bold text-center hover:opacity-90"
          >
            💬 שיתוף בוואטסאפ
          </a>
        </div>
      </div>
    </div>
  );
}
