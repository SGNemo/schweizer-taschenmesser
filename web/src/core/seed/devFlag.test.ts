import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * Builds the real app twice and looks at the output: the test-data tooling must exist in a
 * Dev-Preview build and must be absent – not just unreachable – from every other build.
 */
const MARKERS = [
  'seed.state', // runner state key (core/seed/dev.ts)
  'tm-seed-autofilled', // auto-fill mark
  'nemo-demo', // demo vault passphrase
  'Seed-Sync erlauben', // dev settings text (strings.dev.ts)
  'Ideen für den Balkon', // content of a module seed.ts (notes)
  'Komponentenblatt', // component sheet (pages/ComponentSheet, strings.dev.ts)
  'supporter.simulate', // dev supporter status key (core/supporter/devSupporter.ts)
  'Supporter-Status simulieren', // dev settings text (strings.dev.ts)
  'nemo-remote-latency', // remote control latency probe (pages/settings/remoteLatencyStats.ts)
];

// Must not ship in ANY of these builds: the public test key only exists in the E2E build.
const NEVER_SHIPPED = [
  '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664', // E2E_TEST_PUBLIC_KEY
];

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });
}

async function buildApp(channel: string): Promise<{ names: string[]; text: string }> {
  const outDir = mkdtempSync(join(tmpdir(), 'nemo-flag-'));
  dirs.push(outDir);
  vi.stubEnv('VITE_RELEASE_CHANNEL', channel);
  vi.stubEnv('NODE_ENV', 'production'); // a real build: import.meta.env.DEV is false
  vi.stubEnv('TAURI_ENV_PLATFORM', 'linux'); // no service worker: much faster
  await build({
    configFile: join(process.cwd(), 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true, reportCompressedSize: false },
  });
  vi.unstubAllEnvs();
  const files = filesOf(outDir).filter((f) => /\.(js|css|html)$/.test(f));
  return { names: files, text: files.map((f) => readFileSync(f, 'utf8')).join('\n') };
}

/**
 * Chunk name without directory and content hash. `vite.config.ts` sets no file-name pattern, so
 * Vite 8 / Rolldown uses `[name]-[hash].ext` with an 8-character base64url hash (`[A-Za-z0-9_-]`).
 * The hash is random-looking text and can spell "seed" (`settings-small-DvYCsEed.js`, PR #837).
 */
const chunkName = (path: string): string =>
  path
    .split(/[\\/]/)
    .pop()!
    .replace(/-[\w-]{8}\.(js|css)$/, '');

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('chunkName', () => {
  it('ignores "seed" inside the content hash but not in the name', () => {
    expect(chunkName('/out/assets/settings-small-DvYCsEed.js')).toBe('settings-small');
    expect(chunkName('C:\\out\\assets\\index-a_b-c1D2.css')).toBe('index');
    expect(/seed/i.test(chunkName('/out/assets/settings-small-DvYCsEed.js'))).toBe(false);
    expect(/seed/i.test(chunkName('/out/assets/seed-abc12345.js'))).toBe(true);
    expect(/seed/i.test(chunkName('/out/assets/devSeed-Ab_-9xYz.js'))).toBe(true);
  });
});

describe('Dev-Preview flag', () => {
  it('stable build contains no seed tooling', { timeout: 240_000 }, async () => {
    const { names, text } = await buildApp('');
    for (const marker of MARKERS)
      expect(text, `stable build contains "${marker}"`).not.toContain(marker);
    expect(names.filter((n) => /seed/i.test(chunkName(n)))).toEqual([]);
    for (const marker of NEVER_SHIPPED)
      expect(text, `stable build contains the supporter test key`).not.toContain(marker);
  });

  it(
    'dev build contains the seed tooling (so the check above means something)',
    { timeout: 240_000 },
    async () => {
      const { text } = await buildApp('dev');
      for (const marker of MARKERS) expect(text, `dev build lacks "${marker}"`).toContain(marker);
      for (const marker of NEVER_SHIPPED)
        expect(text, 'dev build contains the supporter test key').not.toContain(marker);
    },
  );
});
