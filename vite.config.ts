import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const BACKEND_URL     = process.env.BACKEND_URL     || "http://localhost:3001";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export default defineConfig({
  vite: {
    define: {
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
