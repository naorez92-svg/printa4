import { useState } from "react";
import { supabase } from "../lib/supabase";
import Create from "../components/Create";
import History from "../components/History";

export default function Dashboard() {
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl text-brand font-bold">בשבילי·</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-ink/60 hover:text-ink transition-colors"
        >
          יציאה
        </button>
      </header>
      <Create onSaved={() => setRefresh((r) => r + 1)} />
      <History key={refresh} />
    </div>
  );
}
