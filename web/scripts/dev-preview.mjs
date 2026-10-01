#!/usr/bin/env node
/**
 * Version data of a Dev-Preview build. Reads package.json and the git tags, writes nothing.
 *
 *   node scripts/dev-preview.mjs version         0.3.2-dev.57         (Tauri config, update manifest)
 *   node scripts/dev-preview.mjs full            0.3.2-dev.57+abc1234 (display, release notes)
 *   node scripts/dev-preview.mjs code            Android versionCode (minutes since the epoch)
 *   node scripts/dev-preview.mjs tauri-config    JSON for `tauri build --config` (version)
 *   node scripts/dev-preview.mjs android-config  JSON for `tauri android build --config` (version + versionCode)
 *   node scripts/dev-preview.mjs last-stable-tag newest stable `vX.Y.Z` tag (for the release notes)
 *
 * The build number is the commit count of HEAD (monotonic on `develop`, independent of workflow run
 * counters); the commit id comes from GITHUB_SHA or HEAD. Needs full history and tags (fetch-depth 0).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSemver, isPrerelease } from '../src/core/update/semver.ts';
import { devVersion, devVersionCode, devVersionFull, nextBaseVersion } from './lib/devPreview.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);

const version = () =>
  devVersion(nextBaseVersion(pkgVersion, tags), Number(git('rev-list', '--count', 'HEAD')));
const full = () => devVersionFull(version(), process.env.GITHUB_SHA || git('rev-parse', 'HEAD'));
const code = () => devVersionCode(Date.now());
const lastStableTag = () =>
  tags
    .filter((t) => !isPrerelease(t))
    .sort(compareSemver)
    .at(-1) ?? '';

const [command] = process.argv.slice(2);
try {
  switch (command) {
    case 'version':
      console.log(version());
      break;
    case 'full':
      console.log(full());
      break;
    case 'code':
      console.log(code());
      break;
    case 'tauri-config':
      console.log(JSON.stringify({ version: version() }));
      break;
    case 'android-config':
      console.log(
        JSON.stringify({ version: version(), bundle: { android: { versionCode: code() } } }),
      );
      break;
    case 'last-stable-tag':
      console.log(lastStableTag());
      break;
    default:
      console.error(
        'Usage: dev-preview.mjs version | full | code | tauri-config | android-config | last-stable-tag',
      );
      process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
