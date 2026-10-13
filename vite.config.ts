import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// BASE is set by the GitHub Pages workflow, e.g. "/shesh-besh/".
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'engine/*'],
      manifest: {
        name: 'שש־בש – מאמן אישי',
        short_name: 'שש־בש',
        lang: 'he',
        dir: 'rtl',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0F4C3A',
        theme_color: '#0F4C3A',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,wasm,data,wd,bd,woff2}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024
      }
    })
  ],
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
