import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What is typed for the PC leaves no trace on the phone (`docs/rules/remote-control.md`: never
 * log, store or put into diagnostics any input). A source test: it reads the files a typed text
 * or a pressed key passes through, so a later change that writes one down fails here even if
 * every behaviour test still passes.
 */
const FILES = [
  'src/modules/remote/routes/Keyboard.tsx',
  'src/modules/remote/routes/Touchpad.tsx',
  'src/modules/remote/routes/level.tsx',
  'src/modules/remote/gestures.ts',
  'src/core/remote/session.ts',
  'src/core/platform/tauri/remote.ts',
];
const code = (file: string) =>
  readFileSync(resolve(process.cwd(), file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

describe('typed text and pressed keys leave no trace', () => {
  it.each(FILES)('%s neither logs nor stores', (file) => {
    const text = code(file);
    for (const forbidden of [
      'console.',
      'logLine',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'createRepo',
      'setSettings',
      'useSettings',
      'core/db',
      'core/diagnostics',
      'core/events',
      'navigator.clipboard',
      'postMessage',
      'fetch(',
      'sendBeacon',
    ]) {
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
