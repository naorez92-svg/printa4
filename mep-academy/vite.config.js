import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  plugins: [react()],
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
