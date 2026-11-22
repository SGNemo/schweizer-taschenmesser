#!/usr/bin/env node
/**
 * Fails when an APK is signed with the wrong key (SC2): `--dev` = must NOT be the release key,
 * `--release` = must be exactly the release key (lib/apkSigner.ts).
 *
 *   apksigner verify --print-certs app.apk > certs.txt
 *   node scripts/apk-signer-check.mjs --dev|--release certs.txt
 */
import { readFileSync } from 'node:fs';
import { checkApkSigner, signerDigests, STABLE_APK_CERT_SHA256 } from './lib/apkSigner.ts';

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
const text = readFileSync(file, 'utf8');
const findings = checkApkSigner(text, channel);
const MESSAGES = {
  'no-signer':
    'No signer digest in the apksigner output (APK unsigned, or the output format changed).',
  'dev-apk-signed-with-release-key':
    'The Dev-Preview APK is signed with the release key. ANDROID_DEV_* must hold a keystore of its own: cd web && node scripts/keys.mjs android --dev.',
  'release-apk-wrong-key': `The release APK is not signed with the release key (found ${signerDigests(text).join(', ')}, expected ${STABLE_APK_CERT_SHA256}). ANDROID_KEYSTORE_* no longer holds the release keystore: restore it from the backup copies, never re-key (docs/architecture/releases.md).`,
};
if (findings.length > 0) {
  for (const f of findings) console.error(`::error::${f.rule}: ${MESSAGES[f.rule] ?? f.rule}`);
  process.exit(1);
}
console.log(`APK signer check passed (${channel}).`);
