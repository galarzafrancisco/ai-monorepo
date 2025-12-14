import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you prefer no plugin, you can omit react() and rely on default.
// The plugin adds fast refresh and sensible defaults.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.VITE_BACKEND_PORT || 3000}`,
        changeOrigin: true,
        secure: false,
      },
      "/.well-known": {
        target: `http://localhost:${process.env.VITE_BACKEND_PORT || 3000}`,
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: `http://localhost:${process.env.VITE_BACKEND_PORT || 3000}`,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  clearScreen: false,
  
});
