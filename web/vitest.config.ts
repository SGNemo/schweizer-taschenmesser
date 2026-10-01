import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)),
      tldts: fileURLToPath(new URL('./node_modules/tldts', import.meta.url)),
      '@nemo/vault-core': fileURLToPath(
        new URL('../packages/vault-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    // Node by default: building a jsdom per file cost more than all test bodies together. A file that
    // needs a DOM starts with `// @vitest-environment jsdom`; a forgotten marker fails with
    // "document is not defined". Files that read DOM globals in app code also need the marker.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    css: false,
    // One Dexie copy for app code and dexie-react-hooks, otherwise liveQuery misses local writes.
    server: { deps: { inline: ['dexie', 'dexie-react-hooks'] } },
  },
});
