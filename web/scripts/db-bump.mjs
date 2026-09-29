#!/usr/bin/env node
/**
 * Regenerates src/core/db/schema.snapshot.json (and bumps its version) when the Dexie stores
 * derived from the module manifests changed. Runs the schema test in "update" mode.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const res = spawnSync(process.execPath, [vitest, 'run', 'src/core/db/schema.test.ts'], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, UPDATE_SCHEMA_SNAPSHOT: '1' },
});
process.exit(res.status ?? 1);
