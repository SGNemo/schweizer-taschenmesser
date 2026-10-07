import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@nemo/vault-core': at('../packages/vault-core/src/index.ts'),
      tldts: at('./node_modules/tldts'),
      zod: at('./node_modules/zod'),
    },
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
