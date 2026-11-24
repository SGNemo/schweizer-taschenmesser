#!/usr/bin/env node
/**
 * Switches Android Auto Backup and device-to-device transfer off in the generated manifest (CI, right
 * after `tauri android init`; writes `res/xml/data_extraction_rules.xml` next to it),
 * declares the camera for in-app QR scanning and the two normal network permissions of home-network
 * sync (Wi-Fi callback, multicast lock; never a location permission), and fails when the result is
 * not as expected. Reports the cleartext setting.
 *
 *   node scripts/android-manifest.mjs [path/to/AndroidManifest.xml]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DATA_EXTRACTION_RULES,
  DATA_EXTRACTION_RULES_FILE,
  hardenManifest,
  withCamera,
  withDataExtractionRules,
  withLanWatch,
} from './lib/androidManifest.ts';

const FILE = process.argv[2] ?? 'src-tauri/gen/android/app/src/main/AndroidManifest.xml';
const { xml, cleartext } = hardenManifest(readFileSync(FILE, 'utf8'));
writeFileSync(FILE, withDataExtractionRules(withLanWatch(withCamera(xml))));
// NS5: the rules the manifest now points at (no cloud backup, no device-to-device transfer)
const rules = join(dirname(FILE), DATA_EXTRACTION_RULES_FILE);
mkdirSync(dirname(rules), { recursive: true });
writeFileSync(rules, DATA_EXTRACTION_RULES);
console.log(
  `Android manifest: allowBackup="false", no data extraction; camera and network state declared; usesCleartextTraffic=${cleartext ?? '(unset)'}`,
);
