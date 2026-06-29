import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Stamp the build so events can reveal whether a failing user is running stale
// cached code (old version) vs the latest (a real runtime issue).
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 8);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD),
  },
});
