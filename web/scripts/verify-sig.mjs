#!/usr/bin/env node
/**
 * Checks `<file>.sig` (minisign, made with the updater key) against the public key in the Tauri config.
 *
 *   node scripts/verify-sig.mjs <file> [--pubkey-from src-tauri/tauri.conf.json]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from './lib/args.ts';
import { verifyMinisign } from './lib/minisign.ts';

const file = process.argv[2];
const args = parseArgs(process.argv.slice(3));
if (!file || file.startsWith('--')) {
  console.error('Usage: verify-sig.mjs <file> [--pubkey-from <tauri.conf.json>]');
  process.exit(2);
}
const confPath =
  typeof args['pubkey-from'] === 'string' ? args['pubkey-from'] : 'src-tauri/tauri.conf.json';
try {
  const pubkey = JSON.parse(readFileSync(confPath, 'utf8')).plugins.updater.pubkey;
  verifyMinisign(readFileSync(file), readFileSync(`${file}.sig`, 'utf8'), pubkey);
  console.log(`✓ ${file}: signature matches the updater key`);
} catch (e) {
  console.error(`✗ ${file}: ${e.message}`);
  process.exit(1);
}
