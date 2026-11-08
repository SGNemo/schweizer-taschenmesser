#!/usr/bin/env node
/**
 * Switches Android Auto Backup off in the generated manifest (CI, right after `tauri android init`),
 * declares the camera for in-app QR scanning, and fails when the result is not as expected. Reports
 * the cleartext setting.
 *
 *   node scripts/android-manifest.mjs [path/to/AndroidManifest.xml]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { hardenManifest, withCamera } from './lib/androidManifest.ts';

const FILE = process.argv[2] ?? 'src-tauri/gen/android/app/src/main/AndroidManifest.xml';
const { xml, cleartext } = hardenManifest(readFileSync(FILE, 'utf8'));
writeFileSync(FILE, withCamera(xml));
console.log(
  `Android manifest: allowBackup="false"; camera declared; usesCleartextTraffic=${cleartext ?? '(unset)'}`,
);
