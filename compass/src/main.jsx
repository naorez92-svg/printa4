import { StrictMode, lazy, Suspense, Component } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CompassApp from "./compass/CompassApp";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { initPixel } from "./lib/pixel";

// Meta Pixel — no-op unless VITE_FB_PIXEL_ID is set on the Vercel project.
initPixel();

// Last line of defense: a render crash must never strand the user on a white
// screen. Journey progress lives in localStorage, so a reload always recovers.
class CrashGuard extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err) { console.error("[mitzpen] render crash:", err); }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div dir="rtl" className="min-h-screen bg-ink text-white flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🧭</div>
        <h1 className="text-2xl font-bold font-display mb-2">אופס, משהו הסתבך לרגע</h1>
        <p className="text-white/50 mb-6 max-w-sm leading-relaxed">
          אל דאגה — כל ההתקדמות שלך שמורה. לחיצה אחת ואתה ממשיך בדיוק מאותה נקודה.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-l from-brand to-magic text-white rounded-2xl px-8 py-3.5 font-semibold"
        >
          ממשיכים ←
        </button>
      </div>
    );
  }
}

// /admin — the management dashboard (lazy: regular users never download it).
// /terms + /privacy — the legal pages (lazy for the same reason).
const AdminApp = lazy(() => import("./admin/AdminApp"));
const LegalPage = lazy(() =>
  import("./compass/Legal").then((m) => ({
    default: /^\/privacy(\/|$)/.test(window.location.pathname) ? m.Privacy : m.Terms,
  }))
);
const path = window.location.pathname;
const isAdminRoute = /^\/admin(\/|$)/.test(path);
const isLegalRoute = /^\/(terms|privacy)(\/|$)/.test(path);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CrashGuard>
      {isAdminRoute ? (
        <Suspense fallback={null}>
          <AdminApp />
        </Suspense>
      ) : isLegalRoute ? (
        <Suspense fallback={null}>
          <LegalPage />
        </Suspense>
      ) : (
        <CompassApp />
      )}
      <AccessibilityWidget />
    </CrashGuard>
  </StrictMode>
);
