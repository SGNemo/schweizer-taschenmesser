import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  encodeCode,
  generateKeyPair,
  toHex,
  verifyCode,
  type SupporterTier,
} from '../../../packages/supporter-codes/src/index.ts';
import { formatKeyFile, parseKeyFile, type KeyFile } from './keyfile.ts';
import { readPublicKeys, renderPublicKeys } from './publicKeysFile.ts';

export interface Io {
  out(line: string): void;
  err(line: string): void;
  /** `YYYY-MM-DD` used as the default issue date. */
  today(): string;
  home: string;
  env: Record<string, string | undefined>;
  /** Repository root (for set-public-key's default target). */
  repoRoot: string;
}

export function nodeIo(): Io {
  return {
    out: (l) => process.stdout.write(l + '\n'),
    err: (l) => process.stderr.write(l + '\n'),
    today: () => new Date().toISOString().slice(0, 10),
    home: homedir(),
    env: process.env,
    repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  };
}

const TIERS: SupporterTier[] = ['kaffee', 'kuchen', 'developer'];
const USAGE = `supporter-cli – maintainer tool for Nemo supporter codes (run on your own machine)

  keygen [--key-id N] [--out FILE]           create the signing key pair (once; prints the public key only)
  create --tier T [--name N] [--date D]      print one code        (T: kaffee | kuchen | developer)
  verify CODE [--public-key HEX --key-id N]  check a code offline
  batch  --tier T --count N                  print N codes (one per line)
  set-public-key [--target FILE]             write the public key into the app config (one place)
  print-worker-secret --yes                  print the private key to paste into \`wrangler secret put\` (stdout only)

Common: --key FILE (default: $NEMO_SUPPORTER_KEY_FILE or ~/.nemo-supporter/key-1.txt)
`;

function parseArgs(argv: string[]): { pos: string[]; opt: Record<string, string | true> } {
  const pos: string[] = [];
  const opt: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opt[a.slice(2)] = next;
        i++;
      } else opt[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

function insideGitCheckout(path: string): boolean {
  let dir = path;
  while (!existsSync(dir)) {
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  try {
    execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function keyPath(io: Io, opt: Record<string, string | true>, keyId = 1): string {
  const given = typeof opt.key === 'string' ? opt.key : io.env.NEMO_SUPPORTER_KEY_FILE;
  return resolve(given ?? join(io.home, '.nemo-supporter', `key-${keyId}.txt`));
}

function loadKey(io: Io, opt: Record<string, string | true>): KeyFile | null {
  const path = keyPath(io, opt);
  if (!existsSync(path)) {
    io.err(`No key file at ${path}. Run "keygen" first (or pass --key FILE).`);
    return null;
  }
  const key = parseKeyFile(readFileSync(path, 'utf8'));
  if (!key) io.err(`The key file at ${path} is not a valid supporter key file.`);
  return key;
}

function parseTier(opt: Record<string, string | true>, io: Io): SupporterTier | null {
  const t = opt.tier;
  if (typeof t === 'string' && (TIERS as string[]).includes(t)) return t as SupporterTier;
  io.err(`--tier must be one of: ${TIERS.join(', ')}`);
  return null;
}

/** Returns the process exit code. Never prints key material except where a command says so. */
export async function run(argv: string[], io: Io): Promise<number> {
  const [cmd, ...rest] = argv;
  const { pos, opt } = parseArgs(rest);
  try {
    switch (cmd) {
      case 'keygen': {
        const keyId = opt['key-id'] === undefined ? 1 : Number(opt['key-id']);
        if (!Number.isInteger(keyId) || keyId < 0 || keyId > 254) {
          io.err('--key-id must be an integer 0..254 (255 is reserved for the E2E test key)');
          return 2;
        }
        const out = typeof opt.out === 'string' ? resolve(opt.out) : keyPath(io, {}, keyId);
        if (existsSync(out)) {
          io.err(`Refusing to overwrite ${out}. Move it away first if you really want a new key.`);
          return 1;
        }
        if (insideGitCheckout(dirname(out))) {
          io.err('Refusing to write the private key inside a git checkout. Pick a folder outside.');
          return 1;
        }
        const kp = generateKeyPair();
        mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
        writeFileSync(out, formatKeyFile({ keyId, ...kp }), { mode: 0o600 });
        chmodSync(out, 0o600);
        io.out(`Key pair written to ${out} (mode 600).`);
        io.out(`Public key (key id ${keyId}): ${toHex(kp.publicKey)}`);
        io.out('');
        io.out(
          '!!! KEEP THE FILE SAFE: password manager plus an offline backup in a second place.',
        );
        io.out(
          '!!! Never commit it, never paste it into chats, issues or CI. Losing it means no new',
        );
        io.out('!!! codes can be signed with this key id (old codes keep working).');
        io.out('Next: "set-public-key", then commit the changed publicKeys.ts.');
        return 0;
      }
      case 'create':
      case 'batch': {
        const tier = parseTier(opt, io);
        const key = tier && loadKey(io, opt);
        if (!tier || !key) return 2;
        const count = cmd === 'batch' ? Number(opt.count) : 1;
        if (!Number.isInteger(count) || count < 1 || count > 1000) {
          io.err('--count must be an integer 1..1000');
          return 2;
        }
        const issued = typeof opt.date === 'string' ? opt.date : io.today();
        const name = typeof opt.name === 'string' ? opt.name : undefined;
        for (let i = 0; i < count; i++) {
          io.out(encodeCode({ keyId: key.keyId, tier, issued, name }, key.secretKey));
        }
        return 0;
      }
      case 'verify': {
        const code = pos.join(' ');
        if (!code) {
          io.err('Usage: verify CODE');
          return 2;
        }
        let keys: Record<number, string>;
        if (typeof opt['public-key'] === 'string') {
          keys = { [Number(opt['key-id'] ?? 1)]: opt['public-key'] };
        } else {
          const path = keyPath(io, opt);
          const key = existsSync(path) ? parseKeyFile(readFileSync(path, 'utf8')) : null;
          if (!key) {
            io.err('Pass --public-key HEX --key-id N, or a valid --key FILE.');
            return 2;
          }
          keys = { [key.keyId]: toHex(key.publicKey) };
        }
        const r = verifyCode(code, keys);
        if (!r.ok) {
          io.out('invalid');
          return 1;
        }
        io.out(
          `valid · tier ${r.tier} · issued ${r.issued} · name ${r.name || '–'} · key ${r.keyId}`,
        );
        return 0;
      }
      case 'set-public-key': {
        const key = loadKey(io, opt);
        if (!key) return 2;
        const target =
          typeof opt.target === 'string'
            ? resolve(opt.target)
            : join(io.repoRoot, 'web/src/core/supporter/publicKeys.ts');
        const existing = existsSync(target) ? readPublicKeys(readFileSync(target, 'utf8')) : {};
        existing[key.keyId] = toHex(key.publicKey);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, renderPublicKeys(existing));
        io.out(`Public key for key id ${key.keyId} written to ${target}.`);
        return 0;
      }
      case 'print-worker-secret': {
        if (opt.yes !== true) {
          io.err('This prints the PRIVATE key to stdout. Re-run with --yes to confirm.');
          return 2;
        }
        const key = loadKey(io, opt);
        if (!key) return 2;
        io.err(
          `Paste it at the prompt of: wrangler secret put SUPPORTER_SIGNING_KEY  (key id ${key.keyId}; do not pipe it, that can store an empty value on Windows)`,
        );
        io.out(toHex(key.secretKey));
        return 0;
      }
      default:
        io.out(USAGE);
        return cmd === undefined || cmd === 'help' || cmd === '--help' ? 0 : 2;
    }
  } catch (e) {
    // Messages from our own validation only; never include argv or key material.
    io.err(`Error: ${e instanceof RangeError ? e.message : 'unexpected failure'}`);
    return 1;
  }
}
