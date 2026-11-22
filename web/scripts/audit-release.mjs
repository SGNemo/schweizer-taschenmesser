#!/usr/bin/env node
/**
 * Fails when something secret is about to be published or embedded:
 *
 *   node scripts/audit-release.mjs --path <file-or-dir> [--path …] [--pubkey-from src-tauri/tauri.conf.json] [--publish]
 *
 * Secrets are taken from the environment variables named in AUDIT_SECRET_ENV (comma separated); their
 * values are searched for in every file (also inside APK/JAR/ZIP containers). Only variable names are
 * ever printed. With --pubkey-from, every *.sig found must carry the key id of that public key.
 * A path without files always fails. With --publish (a run that uploads), every name in
 * AUDIT_SECRET_ENV must have a value and --pubkey-from must find at least one signature.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { auditFiles, checkSignatures, coverageFindings } from './lib/audit.ts';

const args = process.argv.slice(2);
const values = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));

function walk(path, out = []) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      walk(join(path, entry), out);
    }
  } else if (st.size <= 512 * 1024 * 1024) out.push(path);
  return out;
}

const paths = values('--path');
if (paths.length === 0) {
  console.error(
    'Usage: audit-release.mjs --path <file-or-dir> [--path …] [--pubkey-from <tauri.conf.json>]',
  );
  process.exit(2);
}
const missing = paths.filter((p) => !existsSync(p));
if (missing.length > 0) {
  console.error(`Nothing to audit at: ${missing.join(', ')}`);
  process.exit(2);
}

const publish = args.includes('--publish');
const perPath = paths.map((p) => ({ path: p, found: walk(p) }));
const files = perPath.flatMap((p) => p.found).map((p) => ({ name: p, data: readFileSync(p) }));
// Name/value pairs the audit searches for (values only ever compared, never printed).
const searchFor = (process.env.AUDIT_SECRET_ENV ?? '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)
  .map((name) => ({ name, value: process.env[name] ?? '' }));
// Names only from here on: nothing that holds a value goes into a message.
const listed = searchFor.map((s) => s.name);
const configured = searchFor.filter((s) => s.value.trim() !== '').map((s) => s.name);

const findings = auditFiles(files, searchFor);

const confPath = values('--pubkey-from')[0];
let signatures;
if (confPath) {
  const pubkey = JSON.parse(readFileSync(confPath, 'utf8')).plugins?.updater?.pubkey ?? '';
  const sigs = files
    .filter((f) => f.name.endsWith('.sig'))
    .map((f) => ({ name: f.name, content: f.data.toString('utf8') }));
  findings.push(...checkSignatures(sigs, pubkey));
  signatures = sigs.length;
  console.log(`Checked ${sigs.length} updater signature(s) against the public key in ${confPath}.`);
}

findings.push(
  ...coverageFindings({
    publish,
    paths: perPath.map((p) => ({ path: p.path, files: p.found.length })),
    listed,
    provided: configured,
    signatures,
  }),
);

console.log(
  `Audited ${files.length} file(s); searched for ${configured.length} secret value(s) (${configured.join(', ') || 'none configured'})${publish ? ', publishing' : ', dry run'}.`,
);
if (findings.length > 0) {
  const unset = findings.filter((f) => f.rule === 'secret-not-provided');
  for (const f of findings) {
    if (f.rule === 'secret-not-provided') continue;
    console.error(`::error::${f.rule}: ${f.file}${f.detail ? ` (${f.detail})` : ''}`);
  }
  if (unset.length > 0) {
    console.error(
      `::error::secret-not-provided: ${unset.length} name(s) from AUDIT_SECRET_ENV without a value (or the list is empty). Check the GitHub secrets mapped in this workflow step (node scripts/keys.mjs secrets).`,
    );
    // Variable names only, on stdout like the "searched for" line above.
    console.log(`Without a value: ${unset.map((f) => f.detail).join(', ')}`);
  }
  console.error(`\nAudit FAILED with ${findings.length} finding(s). Nothing may be published.`);
  process.exit(1);
}
console.log('Audit passed: no secrets, keystores, private keys or forbidden files found.');
