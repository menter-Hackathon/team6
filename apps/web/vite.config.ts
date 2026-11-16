import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Polling also detects edits made through external workspace tools.
    watch: { usePolling: true, interval: 250 },
  },
});
