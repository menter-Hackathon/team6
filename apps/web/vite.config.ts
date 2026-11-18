import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api/reaction": {
          target: env.VITE_SERVER_URL ?? "http://127.0.0.1:2567",
          changeOrigin: true,
        },
      },
      // Polling also detects edits made through external workspace tools.
      watch: { usePolling: true, interval: 250 },
    },
  };
});
