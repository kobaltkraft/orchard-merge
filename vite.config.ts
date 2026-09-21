import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173, host: false },
  preview: { port: 4173 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Orchard Merge — Pocket Grove',
        short_name: 'OrchardMerge',
        description: 'Original offline merge-fruit arcade game. Drop, merge, bloom.',
        theme_color: '#1d3a2a',
        background_color: '#0e1f16',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,wav,mp3,ogg,json}'],
        // theme tracks exceed the 2MB default; keep them precached for offline
        maximumFileSizeToCacheInBytes: 5_000_000,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
});
