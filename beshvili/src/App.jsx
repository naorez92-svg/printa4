import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PublicBooklet from "./pages/PublicBooklet";
import { track } from "./hooks/useEvents";

// /b/:token — public booklet share page (no auth needed)
const shareMatch = window.location.pathname.match(/^\/b\/([0-9a-f-]{36})$/i);

function AuthApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (_e === "SIGNED_IN") track("session_start", {});
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center" dir="rtl">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-magic animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
  return session ? <Dashboard /> : <Login />;
}

export default function App() {
  if (shareMatch) return <PublicBooklet token={shareMatch[1]} />;
  return <AuthApp />;
}
