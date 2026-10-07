#!/usr/bin/env node
/**
 * Helper to create the two signing identities of a release. Run it on YOUR machine (never in CI).
 *
 *   node scripts/keys.mjs updater    Tauri updater key pair (signs Windows updates)
 *   node scripts/keys.mjs updater --dev   second pair for the Dev-Preview channel (never the stable key)
 *   node scripts/keys.mjs android    Android release keystore (signs the APK)
 *   node scripts/keys.mjs secrets    which GitHub secrets to create and how
 *
 * Keys are written to ~/.taschenmesser-keys/ (override with KEYS_DIR) and refuse to go anywhere
 * inside a git checkout. The private material never enters the repository: only the public updater
 * key is pasted into src-tauri/tauri.conf.json.
 *
 * !!! The Android keystore must NEVER be lost: without it no update can be installed over an existing
 * !!! installation any more (Android only accepts updates signed with the same key). Keep at least two
 * !!! copies in different places (password manager + offline backup).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const dir = resolve(process.env.KEYS_DIR ?? join(homedir(), '.taschenmesser-keys'));
const webRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');

function insideGitCheckout(path) {
  try {
    execFileSync('git', ['-C', path, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function prepareDir() {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (insideGitCheckout(dir)) {
    console.error(`Refusing to write keys inside a git checkout: ${dir}`);
    process.exit(1);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function updater() {
  prepareDir();
  // The Dev-Preview channel signs with its own pair, so a preview binary never carries a valid
  // stable signature (and a stable one never a valid dev signature).
  const dev = process.argv.includes('--dev');
  const key = join(dir, dev ? 'taschenmesser-updater-dev.key' : 'taschenmesser-updater.key');
  const secret = dev ? 'TAURI_DEV_SIGNING_PRIVATE_KEY' : 'TAURI_SIGNING_PRIVATE_KEY';
  const conf = dev ? 'tauri.dev.conf.json' : 'tauri.conf.json';
  if (existsSync(key)) {
    console.error(
      `${key} exists already – not overwriting. Move it away first if you really want a new key.`,
    );
    process.exit(1);
  }
  console.log(
    `Creating the ${dev ? 'Dev-Preview ' : ''}updater key pair. Choose a password and remember it.\n`,
  );
  run('npx', ['tauri', 'signer', 'generate', '-w', key]);
  console.log(`
Done.
  private key : ${key}   → GitHub secret ${secret} (file content)
  password    : the one you just chose → GitHub secret ${secret}_PASSWORD
  public key  : ${key}.pub → paste its content into "plugins.updater.pubkey" in
                ${join(webRoot, 'src-tauri', conf)} and commit that change.
Back the private key and the password up (password manager + offline copy).`);
}

function android() {
  prepareDir();
  const keystore = join(dir, 'taschenmesser-release.jks');
  if (existsSync(keystore)) {
    console.error(`${keystore} exists already – not overwriting.`);
    process.exit(1);
  }
  console.log('Creating the Android release keystore (RSA 4096, valid ~27 years).\n');
  run('keytool', [
    '-genkeypair',
    '-v',
    '-keystore',
    keystore,
    '-alias',
    'taschenmesser',
    '-keyalg',
    'RSA',
    '-keysize',
    '4096',
    '-validity',
    '10000',
  ]);
  chmodSync(keystore, 0o600);
  const b64 = join(dir, 'taschenmesser-release.jks.base64');
  writeFileSync(b64, readFileSync(keystore).toString('base64'), { mode: 0o600 });
  console.log(`
Done.
  keystore : ${keystore}
  base64   : ${b64}   → GitHub secret ANDROID_KEYSTORE_BASE64 (file content)
  alias    : taschenmesser                → GitHub secret ANDROID_KEY_ALIAS
  passwords: what you just typed         → ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_PASSWORD

!!! NEVER LOSE THE KEYSTORE. Without it, installed apps can no longer be updated.
!!! Store copies in a password manager and on an offline medium.`);
}

function secrets() {
  console.log(`GitHub secrets (Repository → Settings → Secrets and variables → Actions):

  TAURI_SIGNING_PRIVATE_KEY            content of taschenmesser-updater.key
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD   its password
  TAURI_DEV_SIGNING_PRIVATE_KEY        content of taschenmesser-updater-dev.key (Dev-Preview channel)
  TAURI_DEV_SIGNING_PRIVATE_KEY_PASSWORD  its password
  ANDROID_KEYSTORE_BASE64              content of taschenmesser-release.jks.base64
  ANDROID_KEYSTORE_PASSWORD            keystore password
  ANDROID_KEY_ALIAS                    taschenmesser
  ANDROID_KEY_PASSWORD                 key password (often the same as the keystore password)

With the GitHub CLI (from the repository, keys in ${dir}):

  gh secret set TAURI_SIGNING_PRIVATE_KEY < "${join(dir, 'taschenmesser-updater.key')}"
  gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  gh secret set TAURI_DEV_SIGNING_PRIVATE_KEY < "${join(dir, 'taschenmesser-updater-dev.key')}"
  gh secret set TAURI_DEV_SIGNING_PRIVATE_KEY_PASSWORD
  gh secret set ANDROID_KEYSTORE_BASE64 < "${join(dir, 'taschenmesser-release.jks.base64')}"
  gh secret set ANDROID_KEYSTORE_PASSWORD
  gh secret set ANDROID_KEY_ALIAS --body taschenmesser
  gh secret set ANDROID_KEY_PASSWORD`);
}

const commands = { updater, android, secrets };
const command = commands[process.argv[2]];
if (!command) {
  console.error('Usage: keys.mjs updater [--dev] | android | secrets');
  process.exit(2);
}
command();
