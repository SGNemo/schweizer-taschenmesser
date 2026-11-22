#!/usr/bin/env node
/**
 * Fails when an APK is signed with the wrong key (SC2): `--dev` = must NOT be the release key,
 * `--release` = must be exactly the release key (lib/apkSigner.ts).
 *
 *   apksigner verify --print-certs app.apk > certs.txt
 *   node scripts/apk-signer-check.mjs --dev|--release certs.txt
 */
import { readFileSync } from 'node:fs';
import { checkApkSigner } from './lib/apkSigner.ts';

const channel = process.argv.includes('--dev')
  ? 'dev'
  : process.argv.includes('--release')
    ? 'release'
    : undefined;
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!channel || !file) {
  console.error('Usage: apk-signer-check.mjs --dev|--release <apksigner --print-certs output>');
  process.exit(2);
}
const findings = checkApkSigner(readFileSync(file, 'utf8'), channel);
if (findings.length > 0) {
  for (const f of findings) console.error(`::error::${f.rule}`);
  console.error(
    channel === 'dev'
      ? 'The Dev-Preview APK is signed with the release key. ANDROID_DEV_* must hold a keystore of its own: node scripts/keys.mjs android --dev.'
      : 'The release APK is not signed with the release key (lib/apkSigner.ts).',
  );
  process.exit(1);
}
console.log(`APK signer check passed (${channel}).`);
