#!/usr/bin/env node
/**
 * Switches Android Auto Backup off in the generated manifest (CI, right after `tauri android init`),
 * declares the camera for in-app QR scanning and the two normal network permissions of home-network
 * sync (Wi-Fi callback, multicast lock; never a location permission), and fails when the result is
 * not as expected. Reports the cleartext setting.
 *
 *   node scripts/android-manifest.mjs [path/to/AndroidManifest.xml]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { hardenManifest, withCamera, withLanWatch } from './lib/androidManifest.ts';

const FILE = process.argv[2] ?? 'src-tauri/gen/android/app/src/main/AndroidManifest.xml';
const { xml, cleartext } = hardenManifest(readFileSync(FILE, 'utf8'));
writeFileSync(FILE, withLanWatch(withCamera(xml)));
console.log(
  `Android manifest: allowBackup="false"; camera and network state declared; usesCleartextTraffic=${cleartext ?? '(unset)'}`,
);
