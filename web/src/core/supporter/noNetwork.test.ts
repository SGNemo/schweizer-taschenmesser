import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The supporter part of the app never talks to the network (code check is offline). */
describe('core/supporter source', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'));

  it('has source files to scan', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each(files)('%s uses no network API and no platform http', (file) => {
    const text = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(text).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|getPlatform\s*\(\)\s*\.\s*(http|net)|\.openUrl|https?:\/\//,
    );
  });
});
