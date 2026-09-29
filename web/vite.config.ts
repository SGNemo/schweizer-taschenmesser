import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Taschenmesser',
        short_name: 'Taschenmesser',
        description: 'Modulare, lokale Alltags-App',
        lang: 'de',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        categories: ['productivity', 'utilities'],
        background_color: '#f7f7f5',
        theme_color: '#2f6f8f',
        // Android "Teilen" → Merkliste (opens the create dialog with the shared link).
        share_target: {
          action: '/bookmarks',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Merkzettel anlegen', url: '/bookmarks?new=1' },
          { name: 'Suchen', url: '/?search=1' },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
