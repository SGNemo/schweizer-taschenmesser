#!/usr/bin/env node
/**
 * Checks the merged manifest of a built APK against the allow-list in lib/apkManifest.ts (NS4):
 * permissions, exported components, no cleartext, no backup, not debuggable.
 *
 *   apkanalyzer manifest print app.apk > merged.xml
 *   node scripts/apk-manifest-check.mjs merged.xml
 */
import { readFileSync } from 'node:fs';
import { checkMergedManifest, parseManifest } from './lib/apkManifest.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: apk-manifest-check.mjs <merged-manifest.xml>');
  process.exit(2);
}
const xml = readFileSync(file, 'utf8');
try {
  const m = parseManifest(xml);
  console.log(
    `Permissions (${m.permissions.length}):\n  ${m.permissions.join('\n  ') || '(none)'}`,
  );
  console.log(
    `Exported components (${m.exported.length}):\n  ${m.exported.join('\n  ') || '(none)'}`,
  );
  const app = m.application;
  console.log(
    `allowBackup=${app['android:allowBackup'] ?? '(unset)'} usesCleartextTraffic=${app['android:usesCleartextTraffic'] ?? '(unset)'} debuggable=${app['android:debuggable'] ?? '(unset)'} networkSecurityConfig=${app['android:networkSecurityConfig'] ?? '(unset)'}`,
  );
} catch {
  // reported as a finding below
}
const findings = checkMergedManifest(xml);
if (findings.length > 0) {
  for (const f of findings) console.error(`::error::${f.rule}${f.detail ? `: ${f.detail}` : ''}`);
  console.error(
    `\nMerged manifest check FAILED (${findings.length}). Review the change; a new entry goes into APK_ALLOW_LIST in scripts/lib/apkManifest.ts with a reason.`,
  );
  process.exit(1);
}
console.log('Merged manifest check passed.');
