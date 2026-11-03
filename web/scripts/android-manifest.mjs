#!/usr/bin/env node
/**
 * Switches Android Auto Backup off in the generated manifest (CI, right after `tauri android init`)
 * and fails when the result is not as expected. Reports the cleartext setting.
 *
 *   node scripts/android-manifest.mjs [path/to/AndroidManifest.xml]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { hardenManifest } from './lib/androidManifest.ts';

const FILE = process.argv[2] ?? 'src-tauri/gen/android/app/src/main/AndroidManifest.xml';
const { xml, cleartext } = hardenManifest(readFileSync(FILE, 'utf8'));
writeFileSync(FILE, xml);
console.log(
  `Android manifest: allowBackup="false"; usesCleartextTraffic=${cleartext ?? '(unset)'}`,
);
