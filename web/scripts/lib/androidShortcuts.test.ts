import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STABLE_APP_ID, setShortcutAppId } from './androidShortcuts';

const tauri = resolve(__dirname, '../../src-tauri');
const res = join(tauri, 'plugins/share-intent/android/src/main/res');
const shortcuts = readFileSync(join(res, 'xml/shortcuts.xml'), 'utf8');
const workflows = resolve(__dirname, '../../../.github/workflows');
const conf = (f: string) =>
  (JSON.parse(readFileSync(join(tauri, f), 'utf8')) as { identifier: string }).identifier;

describe('Android launcher shortcuts', () => {
  it('commits the stable app id, which is the identifier of tauri.conf.json', () => {
    expect(conf('tauri.conf.json')).toBe(STABLE_APP_ID);
    expect(shortcuts.match(/android:targetPackage="([^"]+)"/g)).toEqual(
      Array(3).fill(`android:targetPackage="${STABLE_APP_ID}"`),
    );
  });

  it('offers capture, search and Heute, each with one fixed open extra', () => {
    const ids = [...shortcuts.matchAll(/android:shortcutId="([^"]+)"/g)].map((m) => m[1]);
    const opens = [...shortcuts.matchAll(/shareintent\.OPEN"\s+android:value="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(ids).toEqual(['capture', 'search', 'today']);
    expect(opens).toEqual(ids);
  });

  it('rewrites package and class to the Dev-Preview id and refuses nonsense', () => {
    const dev = conf('tauri.dev.conf.json');
    const out = setShortcutAppId(shortcuts, dev);
    expect(out.match(/android:targetPackage="([^"]+)"/g)).toEqual(
      Array(3).fill(`android:targetPackage="${dev}"`),
    );
    expect(out).toContain(`android:targetClass="${dev}.MainActivity"`);
    expect(out).not.toContain(`"${STABLE_APP_ID}.MainActivity"`);
    // Running it twice (or with the stable id) changes nothing further.
    expect(setShortcutAppId(out, dev)).toBe(out);
    expect(setShortcutAppId(shortcuts, STABLE_APP_ID)).toBe(shortcuts);
    expect(() => setShortcutAppId(shortcuts, 'x"/><evil')).toThrow();
    expect(() => setShortcutAppId('<shortcuts/>', dev)).toThrow();
  });

  it('is patched right after `tauri android init` in the release and Dev-Preview builds', () => {
    for (const [file, config] of [
      ['release.yml', 'src-tauri/tauri.conf.json'],
      ['dev-preview.yml', 'src-tauri/tauri.dev.conf.json'],
    ] as const) {
      const yml = readFileSync(join(workflows, file), 'utf8');
      const init = yml.indexOf('npx tauri android init');
      const patch = yml.indexOf(`node scripts/android-shortcuts.mjs ${config}`);
      const build = yml.indexOf('npx tauri android build');
      expect(init, file).toBeGreaterThan(0);
      expect(patch, file).toBeGreaterThan(init);
      expect(build, file).toBeGreaterThan(patch);
    }
  });

  it('has every label in all five app languages', () => {
    const keys = (dir: string) =>
      [
        ...readFileSync(join(res, dir, 'strings.xml'), 'utf8').matchAll(
          /<string name="([^"]+)">([^<]*)</g,
        ),
      ]
        .map((m) => {
          // aapt2 rejects an unescaped apostrophe.
          expect(m[2], `${dir}/${m[1]}`).not.toMatch(/(^|[^\\])'/);
          return m[1];
        })
        .sort();
    const dirs = readdirSync(res).filter(
      (d) => d.startsWith('values') && d !== 'values' && !d.includes('night'),
    );
    expect(dirs.sort()).toEqual(['values-de', 'values-es', 'values-fr', 'values-pt-rBR']);
    const base = keys('values');
    for (const ref of shortcuts.matchAll(/@string\/(\w+)/g)) expect(base).toContain(ref[1]);
    for (const d of dirs) expect(keys(d), d).toEqual(base);
    const manifest = readFileSync(join(res, '../AndroidManifest.xml'), 'utf8');
    for (const ref of manifest.matchAll(/@string\/(\w+)/g)) expect(base).toContain(ref[1]);
  });
});
