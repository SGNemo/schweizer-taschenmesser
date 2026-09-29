#!/usr/bin/env node
/**
 * Signs a release APK: zipalign, then apksigner (v2/v3 scheme), then verifies the result.
 *
 *   node scripts/android-sign.mjs <unsigned.apk> <signed.apk>
 *
 * Environment: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS,
 * ANDROID_KEY_PASSWORD, and ANDROID_HOME (or ANDROID_SDK_ROOT) for the build tools.
 * Passwords are handed to apksigner through environment variables, never on the command line.
 *
 * The APK is signed here instead of in Gradle so that it does not depend on patches to the
 * generated Android project.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBuildTools, readSigningEnv } from './lib/android.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: android-sign.mjs <unsigned.apk> <signed.apk>');
  process.exit(2);
}

const signing = readSigningEnv(process.env);
if (Array.isArray(signing)) {
  console.error(`Missing signing environment: ${signing.join(', ')}`);
  process.exit(1);
}
const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const tools = home ? findBuildTools(home) : undefined;
if (!tools) {
  console.error('Android build-tools not found (set ANDROID_HOME).');
  process.exit(1);
}
const exe = (name) => join(tools, process.platform === 'win32' ? `${name}.bat` : name);
const run = (file, args, env = process.env) => execFileSync(file, args, { stdio: 'inherit', env });

const dir = mkdtempSync(join(tmpdir(), 'apk-'));
try {
  const aligned = join(dir, 'aligned.apk');
  // -p: page-align stored .so files (needed for 16 KB page devices), 4-byte alignment.
  run(exe('zipalign'), ['-p', '-f', '4', input, aligned]);
  run(
    exe('apksigner'),
    [
      'sign',
      '--ks',
      signing.keystore,
      '--ks-key-alias',
      signing.alias,
      '--ks-pass',
      'env:APK_KS_PASS',
      '--key-pass',
      'env:APK_KEY_PASS',
      '--out',
      output,
      aligned,
    ],
    { ...process.env, APK_KS_PASS: signing.keystorePassword, APK_KEY_PASS: signing.keyPassword },
  );
  run(exe('apksigner'), ['verify', '--verbose', '--print-certs', output]);
  run(exe('zipalign'), ['-c', '-p', '4', output]);
  console.log(`✓ signed and verified: ${output}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
