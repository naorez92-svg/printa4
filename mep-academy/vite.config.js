import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Build stamp for analytics (same rationale as beshvili/compass): map every
// deployed artifact to a commit so "stale cached code vs real bug" is answerable.
function buildStamp() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 8);
  try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "local"; }
}

// Lesson metadata computed at build time from the content file itself, so the
// landing page / module list never have to load the full ~120KB lessons chunk
// and the counters can never drift from the real content.
const { LESSONS } = await import("./src/data/lessons.js");
const LESSON_SLIDES = Object.fromEntries(
  Object.entries(LESSONS).map(([id, lesson]) => [id, lesson.slides.length])
);

export default defineConfig({
  plugins: [
    react(),
    // אופליין אמיתי: כל נכסי הבילד (כולל ה-chunks העצלים של השיעורים
    // והתקנים) נשמרים מראש בהתקנת ה-SW — ביקור אחד עם רשת ומעכשיו
    // האפליקציה כולה עובדת בלי קליטה, כולל שיעורים שטרם נפתחו.
    // (SW ידני שמסתמך על מטמון-בשעת-שימוש משאיר את הביקור הראשון שבור
    // אופליין — הנכסים נטענו לפני שה-SW קיבל שליטה.)
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // הרישום נעשה ידנית ב-main.jsx (בלי סקריפט inline — CSP)
      manifest: false, // המניפסט הקיים ב-public/ נשאר המקור היחיד
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        // Supabase לא ממופה לשום route ולכן עובר תמיד ישירות לרשת
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-woff",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(buildStamp()),
    __LESSON_SLIDES__: JSON.stringify(LESSON_SLIDES),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
