#!/usr/bin/env node
/**
 * One command for everyday work: the app (Vite dev server, Dev-Preview flavour so an empty app is
 * filled with invented test data) plus a local sync server.
 *
 *   npm run dev:all
 *
 * The sync server gets a random token on every start (printed once, never stored) and keeps its
 * database under node_modules/.cache, so nothing lands in the repository. Without
 * `server/node_modules` only the app starts and the script says how to add the server.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(root, '..', 'server');
const dataDir = join(root, 'node_modules', '.cache', 'dev-all');
mkdirSync(dataDir, { recursive: true });

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
const run = (name, cwd, args, env) => {
  const child = spawn(npm, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`\n[dev:all] ${name} stopped (exit ${code}); stopping the rest.`);
      stop(code ?? 1);
    }
  });
  children.push(child);
};

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const token = randomBytes(24).toString('base64url');
const port = process.env.DEV_SYNC_PORT ?? '8787';

if (existsSync(join(serverDir, 'node_modules'))) {
  run('sync server', serverDir, ['run', 'dev'], {
    SYNC_TOKEN: token,
    PORT: port,
    DB_PATH: join(dataDir, 'sync.db'),
  });
  console.log(`[dev:all] Sync server: http://localhost:${port}  token: ${token}`);
  console.log('[dev:all] Settings → Sync: enter this address and token (valid until you stop).');
} else {
  console.log('[dev:all] No sync server (run `cd server && npm ci` once to add it).');
}
console.log(
  '[dev:all] App: Dev-Preview flavour with test data, URL below. Ctrl+C stops everything.',
);
run('app', root, ['run', 'dev', '--', '--host'], {
  VITE_RELEASE_CHANNEL: 'dev',
  VITE_BUILD_SHA: 'local',
});
