import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { checker } from 'vite-plugin-checker';

// https://vite.dev/config/
export default defineConfig({
  // @ts-expect-error - monorepo vite version mismatch
  plugins: [react(), checker({ typescript: true })],
  resolve: {
    // Fix multiple React instances in monorepo by deduplicating
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    host: true,
    allowedHosts: [
      'air.local',
      'debug.taico.app'
    ],
    port: Number(process.env.UI_PORT) || 2000,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || 3000}`,
        changeOrigin: true,
        secure: false,
      },
      "/.well-known": {
        target: `http://localhost:${process.env.BACKEND_PORT || 3000}`,
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: `http://localhost:${process.env.BACKEND_PORT || 3000}`,
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
