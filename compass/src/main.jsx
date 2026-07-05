import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CompassApp from "./compass/CompassApp";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { initPixel } from "./lib/pixel";

// Meta Pixel — no-op unless VITE_FB_PIXEL_ID is set on the Vercel project.
initPixel();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CompassApp />
    <AccessibilityWidget />
  </StrictMode>
);
