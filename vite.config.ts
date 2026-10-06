import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** MapLibre resolves a sibling worker module; Vite must emit both files. */
function copyMaplibreWorker(): Plugin {
  return {
    name: 'copy-maplibre-worker',
    // writeBundle runs before PWA closeBundle generateSW, so .mjs is precached.
    writeBundle() {
      const distAssets = path.join(rootDir, 'dist', 'assets')
      const srcDir = path.join(rootDir, 'node_modules', 'maplibre-gl', 'dist')
      fs.mkdirSync(distAssets, { recursive: true })
      for (const file of [
        'maplibre-gl-worker.mjs',
        'maplibre-gl-shared.mjs',
      ]) {
        fs.copyFileSync(path.join(srcDir, file), path.join(distAssets, file))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    copyMaplibreWorker(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'data/australia-payphones.geojson',
      ],
      manifest: {
        id: '/',
        name: 'Payphone Router',
        short_name: 'Payphones',
        description:
          'Australia walking routes that detour past Telstra payphones for Payphone Tag.',
        theme_color: '#134539',
        background_color: '#f3ebe0',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
        // Keep GeoJSON out of precache (large); runtime cache instead
        runtimeCaching: [
          {
            urlPattern: /\/data\/australia-payphones\.geojson$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'australia-payphones',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
