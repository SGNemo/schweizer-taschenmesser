// Manual tooling (not part of `npm test`): micro-benchmarks of pure data logic, `npm run measure:micro`.
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: { ...base.test, include: ['scripts/perf/**/*.perf.ts'], testTimeout: 600_000 },
});
