/** Helpers for signing the Android APK in CI (erasable TypeScript, imported by `../android-sign.mjs`). */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const numeric = (v: string): number[] => v.split('.').map((p) => Number.parseInt(p, 10) || 0);

function compareVersions(a: string, b: string): number {
  const x = numeric(a);
  const y = numeric(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Newest `build-tools/<version>` directory of an Android SDK, or undefined. */
export function findBuildTools(androidHome: string): string | undefined {
  const root = join(androidHome, 'build-tools');
  if (!existsSync(root)) return undefined;
  const versions = readdirSync(root).sort(compareVersions);
  // Preview versions ("36.0.0-rc1") are skipped unless they are all there is.
  const stable = versions.filter((v) => !v.includes('-'));
  const newest = (stable.length > 0 ? stable : versions).at(-1);
  return newest ? join(root, newest) : undefined;
}

export interface SigningEnv {
  keystore: string;
  keystorePassword: string;
  alias: string;
  keyPassword: string;
}

/** Reads the signing configuration from the environment; names what is missing instead of failing later. */
export function readSigningEnv(env: Record<string, string | undefined>): SigningEnv | string[] {
  const names = {
    keystore: 'ANDROID_KEYSTORE_PATH',
    keystorePassword: 'ANDROID_KEYSTORE_PASSWORD',
    alias: 'ANDROID_KEY_ALIAS',
    keyPassword: 'ANDROID_KEY_PASSWORD',
  } as const;
  const missing = Object.values(names).filter((n) => !env[n]);
  if (missing.length > 0) return missing;
  return {
    keystore: env[names.keystore]!,
    keystorePassword: env[names.keystorePassword]!,
    alias: env[names.alias]!,
    keyPassword: env[names.keyPassword]!,
  };
}
