import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// Stamp the build so events can reveal whether a failing user is running stale
// cached code (old version) vs the latest (a real runtime issue). Prefer a real
// commit SHA over Date.now() so every production artifact maps to a commit
// (Date.now() made two builds of the same code look different, defeating the point).
function buildStamp() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 8);
  try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return "local"; }
}
const BUILD = buildStamp();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD),
  },
});
