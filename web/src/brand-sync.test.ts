import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGO_ACCENT, LOGO_COLOR, LOGO_PATHS, LOGO_RIM } from './ui/Logo';

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

  it('the logo colour is the accent token, in the app and in the static brand files', () => {
    expect(LOGO_COLOR).toBe('var(--accent)');
    // The static files cannot read a token: they carry its two values, and these must not drift from tokens.css.
    const tokens = read('src/ui/tokens.css');
    const [light, dark] = [...tokens.matchAll(/--accent:\s*(#[0-9a-fA-F]{6})/g)].map((m) =>
      m[1]!.toLowerCase(),
    );
    expect(LOGO_ACCENT).toEqual({ light, dark });
    expect(read('brand/logo-mark.svg')).toContain(`fill="${LOGO_ACCENT.light}"`);
  });

  it('the app icon is the two-colour fish on the ocean gradient, every colour a token', () => {
    // Fish: the dark-theme accent (lower stop) under its hover tone; bands white; eye and tile: the ocean gradient.
    const tokens = read('src/ui/tokens.css');
    const first = (name: string, nth = 0) =>
      [...tokens.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))][
        nth
      ]![1]!.toLowerCase();
    const from = first('--ocean-from');
    const to = first('--ocean-to');
    const hoverDark = first('--accent-hover', 1);
    for (const file of ['app-icon.svg', 'app-icon-maskable.svg']) {
      const text = read(`brand/${file}`);
      const stops = [...text.matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]);
      expect(stops, file).toEqual([from, to, hoverDark, LOGO_ACCENT.dark]);
      expect(text, file).toContain(`fill="${to}"`); // the eye
      expect(text, file).not.toContain(LOGO_ACCENT.light);
    }
    // Android: the foreground carries the fish, the background the gradient (gen-icons writes the drawable from it).
    const fg = [
      ...read('brand/android-foreground.svg').matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g),
    ];
    expect(fg.map((m) => m[1])).toEqual([hoverDark, LOGO_ACCENT.dark]);
    const bg = [
      ...read('brand/android-background.svg').matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g),
    ];
    expect(bg.map((m) => m[1])).toEqual([from, to]);
    const drawable = read('src-tauri/icons/android/drawable/ic_launcher_background_gradient.xml');
    expect(drawable).toContain(`android:startColor="${from}"`);
    expect(drawable).toContain(`android:endColor="${to}"`);
    expect(read('src-tauri/icons/android/mipmap-anydpi-v26/ic_launcher.xml')).toContain(
      '@drawable/ic_launcher_background_gradient',
    );
  });

  it('the one-colour fish stays one piece: the bands are cut inside the body and the rim is put back', () => {
    expect(LOGO_RIM).toBeGreaterThan(0);
    for (const file of [
      'brand/logo-mark.svg',
      'brand/logo-mono.svg',
      'brand/android-monochrome.svg',
      'index.html',
    ]) {
      const text = read(file);
      expect(text, file).toMatch(/<g fill="none" stroke="#000" clip-path="url\(#[^"]+\)">/);
      expect(text, file).toMatch(new RegExp(`stroke="#fff"\\s+stroke-width="${LOGO_RIM}"`));
    }
  });

  it('the wordmark (the pill: mark + NEMO) follows the accent token in both schemes', () => {
    // The wordmark is a separate drawing (docs/decisions/ui-brand.md: "Logo v2"), so it shares the colours, not the paths.
    const light = read('brand/logo-wordmark.svg');
    expect(light).toContain(`--pill:${LOGO_ACCENT.light}`);
    expect(light).toContain(`--pill:${LOGO_ACCENT.dark}`);
    expect(read('brand/logo-wordmark-light.svg')).toContain(`fill="${LOGO_ACCENT.dark}"`);
  });

  it('the wordmark keeps the aspect ratio of ui/Wordmark.tsx (1368:401), so the sidebar box needs no change', () => {
    for (const file of ['logo-wordmark.svg', 'logo-wordmark-light.svg']) {
      const [, , w, h] = read(`brand/${file}`)
        .match(/viewBox="([^"]+)"/)![1]!
        .split(' ')
        .map(Number);
      expect(w! / h!, file).toBeCloseTo(1368 / 401, 2);
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
      'android-background.svg',
      'android-monochrome.svg',
      'logo-wordmark.svg',
      'logo-wordmark-light.svg',
    ]) {
      for (const m of read(`brand/${file}`).matchAll(/ id="([^"]+)"/g)) {
        expect(ids.get(m[1]!), `id ${m[1]} in ${file} and ${ids.get(m[1]!)}`).toBeUndefined();
        ids.set(m[1]!, file);
      }
    }
  });

  it('brand SVGs carry no raster data, fonts or scripts', () => {
    for (const file of [
      'logo-mark.svg',
      'app-icon.svg',
      'logo-wordmark.svg',
      'logo-wordmark-light.svg',
    ]) {
      const text = read(`brand/${file}`);
      expect(text).not.toMatch(/<image|font-family|<script|<text/);
    }
  });
});
