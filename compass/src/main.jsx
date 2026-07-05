import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CompassApp from "./compass/CompassApp";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { initPixel } from "./lib/pixel";

// Meta Pixel — no-op unless VITE_FB_PIXEL_ID is set on the Vercel project.
initPixel();

// /admin — the management dashboard (lazy: regular users never download it).
const AdminApp = lazy(() => import("./admin/AdminApp"));
const isAdminRoute = /^\/admin(\/|$)/.test(window.location.pathname);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <CompassApp />
    )}
    <AccessibilityWidget />
  </StrictMode>
);
