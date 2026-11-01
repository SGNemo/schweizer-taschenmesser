import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { extractChangelogSection } from './scripts/lib/aboutData.ts';
import { onlineOnlyFiles } from './scripts/lib/precacheSplit.ts';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
// The Tauri CLI sets TAURI_ENV_PLATFORM for its build/dev commands. Native builds ship no service
// worker (the shell has its own updater); the PWA hooks are replaced by an inert stub.
const native = Boolean(process.env.TAURI_ENV_PLATFORM);
// Measurement only (`npm run check:bundle`): Vite's manifest plus a per-chunk module list in dist/.vite/.
const bundleReport = process.env.VITE_BUNDLE_REPORT === '1';

/**
 * Files that leave the precache (tools, chat, password dictionaries; rule in
 * scripts/lib/precacheSplit.ts). Filled from the app's bundle, read by the precache filter below; the
 * service worker's runtime cache keeps them after their first (online) use.
 */
const onlineOnly = new Set<string>();

function precacheSplit(): Plugin {
  return {
    name: 'nemo-precache-split',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).flatMap((c) =>
        c.type === 'chunk'
          ? [
              {
                file: c.fileName,
                isEntry: c.isEntry,
                facadeModuleId: c.facadeModuleId,
                imports: c.imports,
                dynamicImports: c.dynamicImports,
                assets: [
                  ...(c.viteMetadata?.importedCss ?? []),
                  ...(c.viteMetadata?.importedAssets ?? []),
                ],
              },
            ]
          : [],
      );
      // Only the app build (the service worker is built separately and has no HTML entry).
      if (!chunks.some((c) => c.isEntry && c.facadeModuleId?.endsWith('index.html'))) return;
      onlineOnly.clear();
      for (const f of onlineOnlyFiles(chunks)) onlineOnly.add(f);
    },
    writeBundle(options) {
      if (!bundleReport || onlineOnly.size === 0) return;
      const dir = `${options.dir ?? 'dist'}/.vite`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/lazy-online.json`, JSON.stringify([...onlineOnly].sort()));
    },
  };
}

const short = (id: string) =>
  id
    .replace(/^.*node_modules\//, 'node_modules/')
    .replace(/^.*\/web\//, '')
    .replace(/^.*\/packages\//, '../packages/');

/** Writes `.vite/modules.json` (chunk file → its modules with rendered size) for scripts/check-bundle.mjs. */
function moduleReport(): Plugin {
  return {
    name: 'nemo-module-report',
    apply: 'build',
    writeBundle(options, bundle) {
      const out: Record<string, [string, number][]> = {};
      for (const [file, c] of Object.entries(bundle)) {
        if (c.type !== 'chunk') continue;
        out[file] = Object.entries(c.modules)
          .map(([id, m]): [string, number] => [short(id), m.renderedLength])
          .sort((a, b) => b[1] - a[1]);
      }
      // Static import edges (module → what it imports statically), for `check:bundle -- --why <text>`.
      const imports: Record<string, string[]> = {};
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id);
        if (info) imports[short(id)] = info.importedIds.map(short);
      }
      const dir = `${options.dir ?? 'dist'}/.vite`;
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/modules.json`, JSON.stringify(out));
      writeFileSync(`${dir}/imports.json`, JSON.stringify(imports));
    },
  };
}

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
    ...(bundleReport ? [moduleReport()] : []),
    precacheSplit(),
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
        // One manifest per build: English as the international default (the app itself follows the
        // device language); the shortcuts below are the only other texts the OS shows.
        description: 'Modular, local-first everyday app',
        lang: 'en',
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
          { name: 'Quick capture', url: '/?capture=1' },
          { name: 'Add to Saved', url: '/bookmarks?new=1' },
          { name: 'Search', url: '/?search=1' },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Tools, chat and the password dictionaries load on first use (decision in
        // docs/decisions/core.md); everything else stays precached so the app works offline.
        manifestTransforms: [
          (entries) => ({
            manifest: entries.filter((e) => !onlineOnly.has(e.url)),
            warnings: [],
          }),
        ],
      },
    }),
  ],
  // Two entries: the app and the small quick-capture window of the desktop shell (capture.html).
  build: {
    manifest: bundleReport,
    rollupOptions: {
      // The shared vault package and tldts have no import-time side effects. Saying so lets the bundler
      // drop unused re-exports of the `@nemo/vault-core` barrel: `core/crypto/random.ts` needs only
      // `randomInt`, and without this the whole public-suffix list (tldts, ~110 KB gzip) sat on the
      // critical path of every start although only the vault's origin matching uses it.
      treeshake: {
        moduleSideEffects: (id: string) =>
          !/[\\/]packages[\\/]vault-core[\\/]src[\\/]|node_modules[\\/]tldts/.test(id),
      },
      // One stable vendor chunk for the libraries every start needs: its hash only changes with a
      // dependency update, so an app update re-downloads less (before, react-dom shared a chunk with app
      // code). Measured: 2 requests fewer on the critical path, no byte added to a lazy path.
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|dexie|dexie-react-hooks|zod|zustand)[\\/]/,
            },
          ],
        },
      },
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
