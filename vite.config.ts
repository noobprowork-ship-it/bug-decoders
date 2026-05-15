// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const BACKEND_URL     = process.env.BACKEND_URL     || "http://localhost:3001";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export default defineConfig({
  vite: {
    define: {
      // Expose GOOGLE_CLIENT_ID to the browser as import.meta.env.VITE_GOOGLE_CLIENT_ID
      // (the VITE_ prefix is the Vite convention for browser-safe env vars)
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(GOOGLE_CLIENT_ID),
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/ws/voice": {
          target: BACKEND_URL.replace(/^http/, "ws"),
          ws: true,
          changeOrigin: true,
        },
      },
    },
  },
});
