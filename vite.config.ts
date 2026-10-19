import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Baloncesto",
        short_name: "Baloncesto",
        description: "Basketball final score predictor",
        id: "/baloncesto/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        start_url: "/baloncesto/",
        scope: "/baloncesto/",
        theme_color: "#f6f1e3",
        background_color: "#f6f1e3",
        lang: "en",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/baloncesto/index.html",
        // Nominatim is network-only: no runtime caching rule is registered for it, and the app
        // already handles failed lookups.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === "nominatim.openstreetmap.org",
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  define: {
    __APP_COMMIT__: JSON.stringify(resolveCommit()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
