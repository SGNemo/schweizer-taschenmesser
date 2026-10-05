import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extractChangelogSection } from './scripts/lib/aboutData.ts';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
// The Tauri CLI sets TAURI_ENV_PLATFORM for its build/dev commands. Native builds ship no service
// worker (the shell has its own updater); the PWA hooks are replaced by an inert stub.
const native = Boolean(process.env.TAURI_ENV_PLATFORM);

/** Short commit id of this build ('' outside a git checkout); shown in Settings → Über Nemo. */
function gitSha(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}
/** This version's section of the changelog (or the unreleased block), shown collapsed in Über Nemo. */
function changelog(): string {
  try {
    const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    return extractChangelogSection(md, pkg.version);
  } catch {
    return '';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(gitSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __CHANGELOG__: JSON.stringify(changelog()),
  },
  plugins: [
    react({ jsxImportSource: '@/core/text/readjsx' }),
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
        background_color: '#f3f4f4',
        theme_color: '#f3f4f4',
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
  // The shared package lives outside `web/` (dev server must be allowed to serve it).
  server: { fs: { allow: ['..'] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The shared package resolves its own dependency from the web install (no second `npm ci`).
      zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)),
      tldts: fileURLToPath(new URL('./node_modules/tldts', import.meta.url)),
      '@nemo/vault-core': fileURLToPath(
        new URL('../packages/vault-core/src/index.ts', import.meta.url),
      ),
      '@noble/curves': fileURLToPath(new URL('./node_modules/@noble/curves', import.meta.url)),
      '@nemo/supporter-codes': fileURLToPath(
        new URL('../packages/supporter-codes/src/index.ts', import.meta.url),
      ),
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
