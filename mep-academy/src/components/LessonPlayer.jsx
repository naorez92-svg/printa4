import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIAGRAMS } from "./diagrams.jsx";
import { loadState, saveState } from "../lib/storage.js";

// נגן שיעור מונפש: שקפים עם קריינות דפדפן (Web Speech API) וכתוביות.
// אם אין קול עברי זמין — הנגן עובר אוטומטית למצב מתוזמן (כתוביות בלבד).

function pickHebrewVoice() {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    return voices.find((v) => v.lang?.toLowerCase().startsWith("he")) || null;
  } catch {
    return null;
  }
}

// זמן קריאה מוערך לשקף במצב ללא קריינות (מילים לדקה ~ 150, מינימום 7 שניות)
function readingMs(text) {
  const words = text.split(/\s+/).length;
  return Math.max(7000, (words / 150) * 60000);
}

export default function LessonPlayer({ lesson, moduleId, onClose }) {
  // המשך מנקודת העצירה האחרונה — קריטי למי שלומד בנסיעות קצרות
  const posKey = `lesson-pos:${moduleId}`;
  const [index, setIndex] = useState(() => {
    const saved = loadState(posKey, 0);
    return Number.isInteger(saved) && saved > 0 && saved < lesson.slides.length ? saved : 0;
  });
  const resumedRef = useRef(index > 0);
  const [playing, setPlaying] = useState(true);
  const [narrationOn, setNarrationOn] = useState(true);
  const [voiceReady, setVoiceReady] = useState(() => !!pickHebrewVoice());
  const timerRef = useRef(null);
  const dialogRef = useRef(null);
  const slideRef = useRef(null);

  const slides = lesson.slides;
  const slide = slides[index];
  const isLast = index >= slides.length - 1;

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // הקולות נטענים אסינכרונית בחלק מהדפדפנים
  useEffect(() => {
    if (!ttsSupported || voiceReady) return;
    const handler = () => setVoiceReady(!!pickHebrewVoice());
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    const t = setTimeout(handler, 500);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
      clearTimeout(t);
    };
  }, [ttsSupported, voiceReady]);

  const useVoice = ttsSupported && narrationOn && voiceReady;

  const stopAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (ttsSupported) window.speechSynthesis.cancel();
  }, [ttsSupported]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= slides.length - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [slides.length]);

  // הפעלת השקף הנוכחי: קריינות (עם התקדמות בסיומה) או טיימר קריאה
  useEffect(() => {
    stopAll();
    if (!playing) return;
    if (useVoice) {
      const u = new SpeechSynthesisUtterance(slide.narration);
      u.lang = "he-IL";
      const v = pickHebrewVoice();
      if (v) u.voice = v;
      u.rate = 1;
      u.onend = () => advance();
      // גיבוי: אם הקריינות נתקעת — ממשיכים לפי זמן קריאה
      timerRef.current = setTimeout(advance, readingMs(slide.narration) * 2.5);
      window.speechSynthesis.speak(u);
    } else {
      timerRef.current = setTimeout(advance, readingMs(slide.narration));
    }
    return stopAll;
  }, [index, playing, useVoice, slide, advance, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  // הנגשה: פוקוס לדיאלוג בפתיחה, Esc לסגירה, חצים לניווט
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // שמירת מיקום — כדי שסגירה באמצע לא תאבד את ההתקדמות
  useEffect(() => {
    saveState(posKey, index);
  }, [index, posKey]);

  // כפתור Back של הטלפון סוגר את השיעור — במקום להעיף מהאתר
  const closeReasonRef = useRef(undefined);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    window.history.pushState({ mepLesson: true }, "");
    const onPop = () => onCloseRef.current(closeReasonRef.current);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const requestClose = (reason) => {
    closeReasonRef.current = reason;
    if (reason === "finished") saveState(posKey, 0); // שיעור שהושלם מתחיל מחדש בפעם הבאה
    window.history.back();
  };

  const goTo = (i) => {
    stopAll();
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") requestClose();
    // RTL: חץ שמאלה = קדימה
    else if (e.key === "ArrowLeft") goTo(index + 1);
    else if (e.key === "ArrowRight") goTo(index - 1);
    else if (e.key === " " && e.target === dialogRef.current) {
      e.preventDefault();
      setPlaying((p) => !p);
    }
  };

  const pct = Math.round(((index + 1) / slides.length) * 100);
  const Diagram = slide.visual ? DIAGRAMS[slide.visual] : null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={lesson.title}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 bg-ink text-white flex flex-col"
    >
      {/* כותרת עליונה */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={() => requestClose()}
          className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 font-semibold"
        >
          ✕ <span className="sr-only">סגירת השיעור</span>יציאה
        </button>
        <p className="font-bold truncate px-2">{lesson.title}</p>
        <span className="font-mono text-sm text-white/80" role="status">
          {index + 1}/{slides.length}
        </span>
      </div>

      {/* חיווי המשך מנקודת עצירה */}
      {resumedRef.current && index > 0 && (
        <div className="flex items-center justify-center gap-3 py-1.5 bg-brand/15 text-sm">
          <span>⏯ ממשיכים מאיפה שעצרת (שקף {index + 1})</span>
          <button
            onClick={() => {
              resumedRef.current = false;
              goTo(0);
            }}
            className="underline font-semibold"
          >
            מהתחלה
          </button>
        </div>
      )}

      {/* פס התקדמות */}
      <div
        className="h-1.5 bg-white/10"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={slides.length}
        aria-valuetext={`שקף ${index + 1} מתוך ${slides.length}`}
      >
        <div className="h-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* גוף השקף */}
      <div ref={slideRef} key={index} className="flex-1 overflow-y-auto px-6 py-6 lesson-slide">
        <div className="max-w-2xl mx-auto space-y-5">
          <h1 className="font-bold text-2xl md:text-3xl leading-snug">{slide.title}</h1>
          {Diagram && (
            <div className="bg-white rounded-2xl p-4">
              <Diagram />
            </div>
          )}
          <ul className="space-y-3">
            {slide.bullets.map((b, i) => (
              <li
                key={i}
                className="lesson-bullet flex gap-3 items-start bg-white/5 rounded-xl px-4 py-3 text-lg"
                style={{ animationDelay: `${i * 0.6 + 0.3}s` }}
              >
                <span className="text-brand font-bold shrink-0" aria-hidden>◀</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* כתוביות */}
      <div className="px-6 pb-2">
        <p
          className="max-w-2xl mx-auto text-sm md:text-base leading-relaxed text-white/90 bg-black/40 rounded-xl px-4 py-3"
          role="status"
          aria-label="כתוביות"
        >
          {slide.narration}
        </p>
      </div>

      {/* פקדים */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-white/10">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 font-bold disabled:opacity-40"
        >
          → <span className="sr-only">שקף </span>הקודם
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded-2xl bg-brand text-ink px-8 py-3 font-bold text-lg hover:opacity-90"
          aria-pressed={playing}
        >
          {playing ? "⏸ השהיה" : "▶️ המשך"}
        </button>
        <button
          onClick={() => (isLast ? requestClose("finished") : goTo(index + 1))}
          className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-3 font-bold"
        >
          {isLast ? "לתרגול ✔" : "הבא ←"}
        </button>
        {ttsSupported && (
          <button
            onClick={() => setNarrationOn((n) => !n)}
            aria-pressed={narrationOn}
            className={`rounded-xl px-4 py-3 font-bold ${narrationOn ? "bg-growdeep" : "bg-white/10"}`}
            title={voiceReady ? "קריינות" : "לא נמצא קול עברי בדפדפן — מוצגות כתוביות בלבד"}
          >
            {narrationOn && voiceReady ? "🔊" : "🔇"}
            <span className="sr-only">הפעלה/כיבוי קריינות</span>
          </button>
        )}
      </div>
      {ttsSupported && narrationOn && !voiceReady && (
        <p className="text-center text-xs text-white/60 pb-3 px-4">
          לא נמצא קול עברי בדפדפן זה — השיעור רץ עם כתוביות. בנייד (Chrome/Android או iPhone) הקריינות בדרך כלל זמינה.
        </p>
      )}
    </div>
  );
}
