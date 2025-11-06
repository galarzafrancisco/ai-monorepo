import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you prefer no plugin, you can omit react() and rely on default.
// The plugin adds fast refresh and sensible defaults.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  clearScreen: false,
});
