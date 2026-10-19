import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify("test123"),
    __APP_BUILD_DATE__: JSON.stringify("2026-01-01T00:00:00.000Z"),
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
