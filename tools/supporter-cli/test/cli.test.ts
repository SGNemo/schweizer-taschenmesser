import { mkdtempSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyCode } from '../../../packages/supporter-codes/src/index.ts';
import { run, type Io } from '../src/cli.ts';

function setup() {
  const home = mkdtempSync(join(tmpdir(), 'nemo-cli-'));
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    today: () => '2026-10-05',
    home,
    env: {},
    repoRoot: home,
  };
  return { home, io, out, err, all: () => [...out, ...err].join('\n') };
}

const secretOf = (path: string) => /secret=([0-9a-f]{64})/.exec(readFileSync(path, 'utf8'))![1]!;

describe('supporter-cli', () => {
  it('keygen writes a 0600 key file outside the repo and prints only the public key', async () => {
    const s = setup();
    expect(await run(['keygen'], s.io)).toBe(0);
    const path = join(s.home, '.nemo-supporter', 'key-1.txt');
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(s.all()).toContain('Public key');
    expect(s.all()).not.toContain(secretOf(path));
  });

  it('keygen refuses to overwrite an existing key', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    const before = readFileSync(join(s.home, '.nemo-supporter', 'key-1.txt'), 'utf8');
    expect(await run(['keygen'], s.io)).toBe(1);
    expect(readFileSync(join(s.home, '.nemo-supporter', 'key-1.txt'), 'utf8')).toBe(before);
  });

  it('keygen refuses a path inside a git checkout', async () => {
    const s = setup();
    expect(await run(['keygen', '--out', join(process.cwd(), 'leak', 'key.txt')], s.io)).toBe(1);
    expect(existsSync(join(process.cwd(), 'leak'))).toBe(false);
  });

  it('create signs a verifiable developer code and never prints the private key', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    s.out.length = 0;
    expect(await run(['create', '--tier', 'developer', '--name', 'Sven'], s.io)).toBe(0);
    const code = s.out[0]!;
    const keyFile = readFileSync(join(s.home, '.nemo-supporter', 'key-1.txt'), 'utf8');
    const pub = /public=([0-9a-f]{64})/.exec(keyFile)![1]!;
    expect(verifyCode(code, { 1: pub })).toMatchObject({
      ok: true,
      tier: 'developer',
      name: 'Sven',
      issued: '2026-10-05',
    });
    expect(s.all()).not.toContain(secretOf(join(s.home, '.nemo-supporter', 'key-1.txt')));
  });

  it('verify accepts a good code and rejects a bad one', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    s.out.length = 0;
    await run(['create', '--tier', 'kaffee'], s.io);
    const code = s.out[0]!;
    s.out.length = 0;
    expect(await run(['verify', code], s.io)).toBe(0);
    expect(s.out[0]).toMatch(/^valid · tier kaffee/);
    expect(await run(['verify', 'NEMO1-nope'], s.io)).toBe(1);
  });

  it('batch prints the requested number of distinct codes', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    s.out.length = 0;
    expect(await run(['batch', '--tier', 'kuchen', '--count', '5'], s.io)).toBe(0);
    expect(new Set(s.out).size).toBe(5);
  });

  it('set-public-key writes the public key to the single app config file and keeps older ids', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    await run(['keygen', '--key-id', '2'], s.io);
    const target = join(s.home, 'publicKeys.ts');
    writeFileSync(target, '');
    await run(['set-public-key', '--target', target], s.io);
    await run(
      ['set-public-key', '--target', target, '--key', join(s.home, '.nemo-supporter', 'key-2.txt')],
      s.io,
    );
    const text = readFileSync(target, 'utf8');
    expect(text).toMatch(/1: '[0-9a-f]{64}'/);
    expect(text).toMatch(/2: '[0-9a-f]{64}'/);
    expect(text).not.toContain(secretOf(join(s.home, '.nemo-supporter', 'key-1.txt')));
  });

  it('print-worker-secret needs --yes and then prints only the secret to stdout', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    const secret = secretOf(join(s.home, '.nemo-supporter', 'key-1.txt'));
    s.out.length = 0;
    expect(await run(['print-worker-secret'], s.io)).toBe(2);
    expect(s.all()).not.toContain(secret);
    expect(await run(['print-worker-secret', '--yes'], s.io)).toBe(0);
    expect(s.out).toEqual([secret]);
    expect(s.err.join('\n')).not.toContain(secret);
  });

  it('errors never contain key material', async () => {
    const s = setup();
    await run(['keygen'], s.io);
    const secret = secretOf(join(s.home, '.nemo-supporter', 'key-1.txt'));
    await run(['create', '--tier', 'kaffee', '--date', '1999-01-01'], s.io);
    await run(['create', '--tier', 'bogus'], s.io);
    expect(s.all()).not.toContain(secret);
    expect(s.err.length).toBeGreaterThan(0);
  });
});
