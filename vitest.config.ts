import { defineConfig } from "vitest/config";

// Vitest enables its `github-actions` reporter when GITHUB_ACTIONS is set, which
// appends a job summary on every run. Stryker runs vitest once per mutant, so
// those appends would overflow GitHub's step-summary size cap. Inside a Stryker
// worker (STRYKER_MUTATOR_WORKER is set) pin the plain reporter instead.
const UNDER_STRYKER = process.env.STRYKER_MUTATOR_WORKER !== undefined;

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify("test123"),
    __APP_BUILD_DATE__: JSON.stringify("2026-01-01T00:00:00.000Z"),
  },
  test: {
    ...(UNDER_STRYKER ? { reporters: ["default"] } : {}),
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
