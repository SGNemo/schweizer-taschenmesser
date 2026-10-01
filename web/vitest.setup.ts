import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// Test files run in the `node` environment by default (see vitest.config.ts). Files that need a DOM
// opt in with `// @vitest-environment jsdom` on their first line; only those get the DOM helpers.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
