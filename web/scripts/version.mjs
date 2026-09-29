#!/usr/bin/env node
/**
 * Single source of truth for the app version: `web/package.json`.
 *
 *   node scripts/version.mjs print            version from package.json
 *   node scripts/version.mjs check            fail unless Cargo.toml/Cargo.lock/tauri.conf.json agree
 *   node scripts/version.mjs sync             copy the version into Cargo.toml and Cargo.lock
 *   node scripts/version.mjs set <version>    bump everything (package.json, lock file, Cargo)
 *   node scripts/version.mjs code             Android versionCode derived from the version
 *   node scripts/version.mjs android-config   JSON for `tauri android build --config '<json>'`
 *
 * Tauri reads the version from package.json (`"version": "../package.json"` in tauri.conf.json);
 * Cargo needs its own copy, which `sync` keeps identical.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidVersionCode, parseSemver } from '../src/core/update/semver.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = (...p) => join(root, ...p);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const PKG = file('package.json');
const PKG_LOCK = file('package-lock.json');
const CARGO_TOML = file('src-tauri', 'Cargo.toml');
const CARGO_LOCK = file('src-tauri', 'Cargo.lock');
const TAURI_CONF = file('src-tauri', 'tauri.conf.json');

const CARGO_NAME = 'taschenmesser';
const TOML_VERSION_RE = /^(version\s*=\s*")([^"]+)(")/m;
const LOCK_VERSION_RE = new RegExp(
  `(\\[\\[package\\]\\]\\nname = "${CARGO_NAME}"\\nversion = ")([^"]+)(")`,
);

export const packageVersion = () => readJson(PKG).version;

function cargoTomlVersion() {
  // Only the [package] section: the first `version = ` line of the file belongs to it.
  return TOML_VERSION_RE.exec(readFileSync(CARGO_TOML, 'utf8'))?.[2];
}
function cargoLockVersion() {
  return existsSync(CARGO_LOCK)
    ? LOCK_VERSION_RE.exec(readFileSync(CARGO_LOCK, 'utf8'))?.[2]
    : undefined;
}

function problems() {
  const version = packageVersion();
  const out = [];
  if (!parseSemver(version)) out.push(`package.json version "${version}" is not valid SemVer`);
  else {
    try {
      androidVersionCode(version);
    } catch (e) {
      out.push(e.message);
    }
  }
  const conf = readJson(TAURI_CONF).version;
  if (conf !== '../package.json') {
    out.push(`tauri.conf.json "version" must be "../package.json" (found "${conf}")`);
  }
  if (cargoTomlVersion() !== version) {
    out.push(
      `Cargo.toml version ${cargoTomlVersion()} != package.json ${version} (run: npm run version:sync)`,
    );
  }
  const lock = cargoLockVersion();
  if (lock !== undefined && lock !== version) {
    out.push(`Cargo.lock version ${lock} != package.json ${version} (run: npm run version:sync)`);
  }
  return out;
}

function sync() {
  const version = packageVersion();
  writeFileSync(
    CARGO_TOML,
    readFileSync(CARGO_TOML, 'utf8').replace(TOML_VERSION_RE, `$1${version}$3`),
  );
  if (existsSync(CARGO_LOCK)) {
    writeFileSync(
      CARGO_LOCK,
      readFileSync(CARGO_LOCK, 'utf8').replace(LOCK_VERSION_RE, `$1${version}$3`),
    );
  }
}

function set(version) {
  if (!version || !parseSemver(version) || version.startsWith('v')) {
    throw new Error(
      'Usage: version.mjs set <SemVer without leading v>, e.g. 1.2.0 or 1.2.0-beta.1',
    );
  }
  androidVersionCode(version); // refuses versions Android cannot order
  const pkg = readJson(PKG);
  pkg.version = version;
  writeFileSync(PKG, `${JSON.stringify(pkg, null, 2)}\n`);
  if (existsSync(PKG_LOCK)) {
    const lock = readJson(PKG_LOCK);
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    writeFileSync(PKG_LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  }
  sync();
}

const [command, arg] = process.argv.slice(2);
try {
  switch (command) {
    case 'print':
      console.log(packageVersion());
      break;
    case 'code':
      console.log(androidVersionCode(packageVersion()));
      break;
    case 'android-config':
      console.log(
        JSON.stringify({
          bundle: { android: { versionCode: androidVersionCode(packageVersion()) } },
        }),
      );
      break;
    case 'sync':
      sync();
      console.log(`Cargo.toml / Cargo.lock now at ${packageVersion()}`);
      break;
    case 'set':
      set(arg);
      console.log(
        `Version set to ${packageVersion()} (versionCode ${androidVersionCode(packageVersion())})`,
      );
      break;
    case 'check': {
      const list = problems();
      if (list.length > 0) {
        console.error(list.map((p) => `✗ ${p}`).join('\n'));
        process.exit(1);
      }
      console.log(`✓ version ${packageVersion()} is consistent`);
      break;
    }
    default:
      console.error(
        'Usage: version.mjs print | check | sync | set <version> | code | android-config',
      );
      process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
