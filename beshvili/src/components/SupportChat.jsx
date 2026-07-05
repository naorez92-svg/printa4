import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { track } from "../hooks/useEvents";

// 24/7 AI support chat — floating bubble (above the feedback pill, left side).
// Short product-FAQ answers from the support-chat edge function; anything the
// bot can't solve escalates to the owner's WhatsApp.

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL || "https://gywpdzkvkdisonuzhsib.supabase.co"}/functions/v1/support-chat`;
const QUICK = ["איך מדפיסים? 🖨️", "מה כוללת תוכנית מורה?", "החוברת לא נוצרת לי", "איך עובד ה-QR שעל החוברת?"];
const GREETING = { role: "assistant", content: "היי! 👋 אני העוזר של בשבילי — אפשר לשאול אותי הכל על יצירה, הדפסה, תוכניות ותקלות. במה לעזור?" };

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (text) => {
    const content = (text ?? input).trim().slice(0, 500);
    if (!content || sending) return;
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setSending(true);
    track("support_msg_sent", {});
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        // Skip the canned greeting — the server only needs the real conversation.
        body: JSON.stringify({ messages: next.slice(1).slice(-8) }),
      });
      const data = await r.json().catch(() => ({}));
      const reply = r.ok
        ? (data.reply || "לא הצלחתי לענות — נסו שוב 🙏")
        : data.error === "rate_limited"
        ? "וואו, הרבה שאלות 😅 נחזור לזה בעוד שעה — או שתכתבו לנאור בוואטסאפ: wa.me/972509139137"
        : "משהו השתבש — נסו שוב, או כתבו לנאור בוואטסאפ: wa.me/972509139137";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "בעיית תקשורת — בדקו את החיבור ונסו שוב 🙏" }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(o => !o); if (!open) track("support_chat_opened", {}); }}
        aria-label={open ? "סגור צ'אט עזרה" : "פתח צ'אט עזרה"}
        className="fixed bottom-36 left-4 lg:bottom-20 z-40 w-12 h-12 rounded-full bg-gradient-to-l from-magic to-brand text-white shadow-lg flex items-center justify-center text-xl hover:scale-105 transition-transform"
      >
        {open ? "×" : "💬"}
      </button>

      {open && (
        <div
          role="dialog" aria-label="צ'אט עזרה"
          className="fixed z-40 inset-x-4 bottom-52 lg:inset-x-auto lg:left-6 lg:bottom-36 lg:w-96 bg-white rounded-2xl shadow-2xl border border-ink/10 flex flex-col overflow-hidden max-h-[60vh] lg:max-h-[28rem]"
          dir="rtl"
        >
          <div className="bg-gradient-to-l from-magic to-brand px-4 py-3 flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-tight">העוזר של בשבילי</p>
              <p className="text-white/70 text-[10px]">עונה תוך שניות · 24/7</p>
            </div>
            <a href="https://wa.me/972509139137" target="_blank" rel="noopener noreferrer"
              className="text-[10px] bg-white/15 text-white rounded-full px-2 py-1 hover:bg-white/25 transition-colors">
              אדם אמיתי 💬
            </a>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-canvas/50 min-h-[10rem]">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-magic text-white mr-auto rounded-tr-sm"
                  : "bg-white border border-ink/8 text-ink ml-auto rounded-tl-sm shadow-sm"
              }`}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="bg-white border border-ink/8 rounded-2xl rounded-tl-sm px-3 py-2 ml-auto w-14 flex gap-1 justify-center shadow-sm">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-ink/25 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            {messages.length === 1 && !sending && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="text-xs border border-magic/30 text-magic bg-white rounded-full px-3 py-1.5 hover:bg-magic/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-ink/8 flex gap-2 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="כתבו שאלה..."
              maxLength={500}
              className="flex-1 border border-ink/15 rounded-xl px-3 py-2 text-sm text-right outline-none focus:border-magic bg-canvas/50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              aria-label="שלח"
              className="w-10 h-10 rounded-xl bg-magic text-white flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
