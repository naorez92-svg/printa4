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

  if (loading) return null;
  return session ? <Dashboard /> : <Login />;
}

export default function App() {
  if (shareMatch) return <PublicBooklet token={shareMatch[1]} />;
  return <AuthApp />;
}
