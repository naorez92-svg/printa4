import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initPixel } from "./lib/pixel";

// Load the Meta Pixel as early as possible so the landing PageView (and any
// retargeting) is captured for every visitor. No-op unless VITE_FB_PIXEL_ID
// is set, so local dev and previews stay clean.
initPixel();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
