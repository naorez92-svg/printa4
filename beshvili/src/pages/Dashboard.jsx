import { useState } from "react";
import { supabase } from "../lib/supabase";
import Create from "../components/Create";
import History from "../components/History";

export default function Dashboard() {
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState("create"); // "create" | "history"

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-ink/5">
        <div className="max-w-2xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <div>
              <span className="font-bold text-ink text-lg font-display">בשבילי</span>
              <span className="text-brand font-bold text-lg">·</span>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-ink/40 hover:text-ink/70 transition-colors border border-ink/15 rounded-lg px-3 py-1.5"
          >
            יציאה
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-5 pb-3 flex gap-1">
          {[["create", "✨ צור חוברת"], ["history", "📂 החוברות שלי"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                tab === id
                  ? "bg-magic text-white shadow-sm"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-5 py-6">
        {tab === "create" && (
          <Create onSaved={() => { setRefresh((r) => r + 1); }} />
        )}
        {tab === "history" && <History key={refresh} />}
      </main>
    </div>
  );
}
