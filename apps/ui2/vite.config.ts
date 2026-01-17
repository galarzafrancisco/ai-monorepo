import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // @ts-expect-error - monorepo vite version mismatch
  plugins: [react()],
  resolve: {
    // Fix multiple React instances in monorepo by deduplicating
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    host: true,
    allowedHosts: [
      'air.local'
    ],
    port: Number(process.env.VITE_PORT) || 1000,
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
