import { execSync } from "node:child_process";
import { defineConfig } from "vite";

function resolveCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  base: "/baloncesto/",
  define: {
    __APP_COMMIT__: JSON.stringify(resolveCommit()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
