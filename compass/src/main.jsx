import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CompassApp from "./compass/CompassApp";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { initPixel } from "./lib/pixel";

// Meta Pixel — no-op unless VITE_FB_PIXEL_ID is set on the Vercel project.
initPixel();

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
  </StrictMode>
);
