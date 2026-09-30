import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
// The Tauri CLI sets TAURI_ENV_PLATFORM for its build/dev commands. Native builds ship no service
// worker (the shell has its own updater); the PWA hooks are replaced by an inert stub.
const native = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      disable: native,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Nemo',
        short_name: 'Nemo',
        description: 'Modulare, lokale Alltags-App',
        lang: 'de',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        categories: ['productivity', 'utilities'],
        background_color: '#fbf8f3',
        theme_color: '#fbf8f3',
        // Android "Teilen" → neutral page where the destination is chosen (Merkliste, Notiz, ToDo).
        // `/bookmarks?title&text&url` keeps working for old bookmarks/links.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Schnell erfassen', url: '/?capture=1' },
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
  // Two entries: the app and the small quick-capture window of the desktop shell (capture.html).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        capture: fileURLToPath(new URL('./capture.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(native
        ? {
            'virtual:pwa-register/react': fileURLToPath(
              new URL('./src/pwa/register-stub.ts', import.meta.url),
            ),
          }
        : {}),
    },
  },
});
