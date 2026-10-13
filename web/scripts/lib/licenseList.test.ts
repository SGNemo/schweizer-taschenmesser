import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cratesFromMetadata,
  lockedCrates,
  modelsFromCatalogue,
  npmFromLock,
  policyProblems,
  type LicenseData,
} from './licenseList';

describe('licence list', () => {
  it('npm: production packages of the lock file, transitive too, dev left out', () => {
    const list = npmFromLock({
      packages: {
        '': { version: '1.0.0' },
        'node_modules/b': { version: '2.0.0', license: 'MIT' },
        'node_modules/a': { version: '1.0.0', license: 'ISC' },
        'node_modules/a/node_modules/c': { version: '3.0.0', license: '0BSD' },
        'node_modules/dev-only': { version: '1.0.0', license: 'MIT', dev: true },
      },
    });
    expect(list.map((e) => `${e.name}@${e.version} ${e.license}`)).toEqual([
      'a@1.0.0 ISC',
      'b@2.0.0 MIT',
      'c@3.0.0 0BSD',
    ]);
  });

  it('npm: scoped packages keep their scope', () => {
    const list = npmFromLock({
      packages: { 'node_modules/@x/y': { version: '1.0.0', license: 'MIT' } },
    });
    expect(list[0]?.name).toBe('@x/y');
  });

  it('cargo: registry crates only, own crates skipped', () => {
    const list = cratesFromMetadata({
      packages: [
        {
          name: 'serde',
          version: '1.0.0',
          source: 'registry+x',
          license: 'MIT OR Apache-2.0',
          repository: null,
        },
        { name: 'taschenmesser', version: '0.3.1', source: null, license: 'MIT', repository: null },
      ],
    });
    expect(list.map((e) => e.name)).toEqual(['serde']);
  });

  it('Cargo.lock: name@version of registry crates', () => {
    const lock = `[[package]]\nname = "a"\nversion = "1.0.0"\nsource = "registry+x"\n\n[[package]]\nname = "own"\nversion = "0.1.0"\n`;
    expect([...lockedCrates(lock)]).toEqual(['a@1.0.0']);
  });

  it('models: label, licence and card of every catalogue entry', () => {
    const list = modelsFromCatalogue({
      models: [
        { label: 'M', repo: 'o/r', baseModel: 'o/b', license: { name: 'Apache License 2.0' } },
      ],
    });
    expect(list).toEqual([
      { name: 'M', version: '', license: 'Apache License 2.0', url: 'https://huggingface.co/o/r' },
    ]);
  });

  it('policy: an unknown or copyleft licence is a problem, a named exception is not needed for allowed ones', () => {
    const base: LicenseData = { schema: 1, npm: [], cargo: [], gradle: [], assets: [], models: [] };
    expect(policyProblems(base)).toEqual([]);
    const bad = policyProblems({
      ...base,
      npm: [
        { name: 'ok', version: '1', license: 'MIT' },
        { name: 'bad', version: '1', license: 'GPL-3.0-only' },
        { name: 'unknown', version: '1', license: 'UNKNOWN' },
      ],
    });
    expect(bad).toHaveLength(2);
    expect(bad[0]).toContain('bad@1');
  });
});

describe('committed licence list (src/core/about/licenses.json)', () => {
  const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
  const data = read('../../src/core/about/licenses.json') as LicenseData;

  it('passes the allowlist', () => {
    expect(policyProblems(data)).toEqual([]);
  });

  it('covers every production package of package-lock.json (run `npm run gen:licenses` after changing dependencies)', () => {
    expect(data.npm).toEqual(npmFromLock(read('../../package-lock.json')));
  });

  it('covers every registry crate of Cargo.lock', () => {
    const lock = lockedCrates(
      readFileSync(new URL('../../src-tauri/Cargo.lock', import.meta.url), 'utf8'),
    );
    expect(new Set(data.cargo.map((c) => `${c.name}@${c.version}`))).toEqual(lock);
  });

  it('lists every downloadable model and the hand-kept groups', () => {
    expect(data.models).toEqual(
      modelsFromCatalogue(read('../../src/core/ai/local/catalogue.json')),
    );
    const manual = read('../licenses.manual.json');
    expect(data.gradle).toEqual(manual.gradle);
    expect(data.assets).toEqual(manual.assets);
  });
});
