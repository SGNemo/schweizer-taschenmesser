import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { setLang } from '@/core/i18n/lang';

// Existing tests assert German texts and formats: every test starts in the German source language.
setLang('de');
afterEach(() => setLang('de'));

// Test files run in the `node` environment by default (see vitest.config.ts). Files that need a DOM
// opt in with `// @vitest-environment jsdom` on their first line; only those get the DOM helpers.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
