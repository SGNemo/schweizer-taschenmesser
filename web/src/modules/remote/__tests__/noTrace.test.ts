import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What is typed for the PC leaves no trace on the phone (`docs/rules/remote-control.md`: never
 * log, store or put into diagnostics any input). A source test: it reads the files a typed text
 * or a pressed key passes through, so a later change that writes one down fails here even if
 * every behaviour test still passes.
 */
/** Every source file of the module and of the session, tests aside – found, not listed. */
function files(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const FILES = [
  ...files('src/modules/remote'),
  ...files('src/core/remote'),
  'src/core/platform/tauri/remote.ts',
];
/** The code without its comments (a comment in front of code on one line hides nothing). */
const code = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
/** The files a typed text passes through: they may not even name a place to keep something. */
const TEXT_PATH = [
  'src/modules/remote/routes/Keyboard.tsx',
  'src/core/remote/session.ts',
  'src/core/platform/tauri/remote.ts',
];

describe('typed text and pressed keys leave no trace', () => {
  it('the files are found', () => {
    for (const file of TEXT_PATH) expect(FILES).toContain(file);
    expect(FILES).toContain('src/modules/remote/session.ts');
    expect(FILES.length).toBeGreaterThan(8);
  });

  it.each(FILES)('%s neither logs nor stores', (file) => {
    const text = code(file);
    for (const forbidden of [
      'logLine',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'createRepo',
      'core/db',
      'core/diagnostics',
      'core/events',
      'navigator.clipboard',
      'postMessage',
      'fetch(',
      'sendBeacon',
      'persist(',
      'SearchParams',
      'history.',
    ]) {
      expect(text, `${file}: ${forbidden}`).not.toContain(forbidden);
    }
    // no console by any name
    expect(text, `${file}: console`).not.toMatch(/\bconsole\b/);
  });

  it.each(TEXT_PATH)('%s names no settings, no store and no address', (file) => {
    const text = code(file);
    for (const forbidden of ['setSettings', 'useSettings', 'zustand', 'create(', 'navigate(']) {
      expect(text, `${file}: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the field has no history and no stored value, and the reading aid stays off it', () => {
    const page = code('src/modules/remote/routes/Keyboard.tsx');
    expect(page).toContain('autoComplete="off"');
    expect(page).toContain('<NoReadAid>');
    // the text lives in one piece of component state and is handed to the session, nowhere else
    expect(page.match(/useState\(''\)/g)).toHaveLength(1);
    expect(page.match(/remoteSession\.type\(/g)).toHaveLength(1);
    expect(page).not.toMatch(/useRef<string|history|lastText|recent/i);
  });

  it('the session keeps a text only in the queue item that types it', () => {
    const session = code('src/core/remote/session.ts');
    // no variable outside the queue holds text, and `done` gets a result word, never the text
    expect(session).not.toMatch(/let \w*[tT]ext\w*\b/);
    expect(session.match(/kind: 'text', pieces, enter, done/g)).toHaveLength(1);
    expect(session).not.toMatch(/done\([^)]*(piece|text|pieces)/);
  });
});
