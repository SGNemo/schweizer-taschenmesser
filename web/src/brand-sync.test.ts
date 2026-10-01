import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGO_COLOR, LOGO_PATHS } from './ui/Logo';

/**
 * The fish exists three times: as SVG source (`brand/logo-mark.svg`, rendered to every icon), in
 * the React `Logo` and in the HTML splash that shows before React loads. This keeps them identical.
 */
const web = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(web, path), 'utf8');

describe('brand assets stay in step', () => {
  const paths = Object.values(LOGO_PATHS);

  it('logo-mark.svg, Logo.tsx and the splash draw the same paths', () => {
    for (const file of ['brand/logo-mark.svg', 'index.html']) {
      const text = read(file);
      for (const d of paths) expect(text, `${file}: ${d.slice(0, 20)}…`).toContain(`d="${d}"`);
    }
  });

  it('every brand SVG uses the same fish', () => {
    for (const file of [
      'logo-mono.svg',
      'app-icon.svg',
      'app-icon-maskable.svg',
      'android-foreground.svg',
      'android-monochrome.svg',
    ]) {
      const text = read(`brand/${file}`);
      for (const d of paths) expect(text, file).toContain(`d="${d}"`);
    }
  });

  it('the wordmark (own fish head and tail, letters outlined) uses the logo colour', () => {
    // The wordmark is a separate drawing (DECISIONS.md: "Wordmark W2"), so it shares the colour, not the paths.
    for (const file of ['logo-wordmark.svg', 'logo-wordmark-light.svg']) {
      expect(read(`brand/${file}`), file).toContain(`fill="${LOGO_COLOR}"`);
    }
  });

  it('SVG ids are unique per file (two inlined files must not collide)', () => {
    const ids = new Map<string, string>();
    for (const file of [
      'logo-mark.svg',
      'logo-mono.svg',
      'app-icon.svg',
      'app-icon-maskable.svg',
      'android-foreground.svg',
      'android-monochrome.svg',
      'logo-wordmark.svg',
    ]) {
      for (const m of read(`brand/${file}`).matchAll(/ id="([^"]+)"/g)) {
        expect(ids.get(m[1]!), `id ${m[1]} in ${file} and ${ids.get(m[1]!)}`).toBeUndefined();
        ids.set(m[1]!, file);
      }
    }
  });

  it('brand SVGs carry no raster data, fonts or scripts', () => {
    for (const file of ['logo-mark.svg', 'app-icon.svg', 'logo-wordmark.svg']) {
      const text = read(`brand/${file}`);
      expect(text).not.toMatch(/<image|font-family|<script|<text/);
    }
  });
});
