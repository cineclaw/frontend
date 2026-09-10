import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/search': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/poster': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/api/ai': {
        target: 'http://127.0.0.1:9120',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/api'),
      },
      '/api/auth': {
        target: 'http://127.0.0.1:9118',
        changeOrigin: true,
      },
      '/api/stream': {
        target: 'http://127.0.0.1:9118',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/series': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
      },
      '/torrents': {
        target: 'http://127.0.0.1:9118',
        changeOrigin: true,
      },
      '/jellyfin': {
        target: process.env.JELLYFIN_DEV_TARGET || 'http://127.0.0.1:8096',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jellyfin/, ''),
        ws: true,
      },
    },
  },
})
