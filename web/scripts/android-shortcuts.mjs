#!/usr/bin/env node
/**
 * Points the Android launcher shortcuts at the app id of the given Tauri config (CI, right after
 * `tauri android init`). Resource XML knows no `${applicationId}`; without this the Dev-Preview's
 * shortcuts would open the stable app.
 *
 *   node scripts/android-shortcuts.mjs src-tauri/tauri.dev.conf.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { setShortcutAppId } from './lib/androidShortcuts.ts';

const FILE = 'src-tauri/plugins/share-intent/android/src/main/res/xml/shortcuts.xml';
const [config] = process.argv.slice(2);
if (!config) {
  console.error('Usage: android-shortcuts.mjs <tauri config with "identifier">');
  process.exit(2);
}
const { identifier } = JSON.parse(readFileSync(config, 'utf8'));
writeFileSync(FILE, setShortcutAppId(readFileSync(FILE, 'utf8'), identifier));
console.log(`Launcher shortcuts target ${identifier}`);
