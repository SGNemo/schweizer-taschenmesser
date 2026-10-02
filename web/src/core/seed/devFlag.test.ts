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

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('Dev-Preview flag', () => {
  it('stable build contains no seed tooling', { timeout: 240_000 }, async () => {
    const { names, text } = await buildApp('');
    for (const marker of MARKERS)
      expect(text, `stable build contains "${marker}"`).not.toContain(marker);
    expect(names.filter((n) => /seed/i.test(n))).toEqual([]);
  });

  it(
    'dev build contains the seed tooling (so the check above means something)',
    { timeout: 240_000 },
    async () => {
      const { text } = await buildApp('dev');
      for (const marker of MARKERS) expect(text, `dev build lacks "${marker}"`).toContain(marker);
    },
  );
});
