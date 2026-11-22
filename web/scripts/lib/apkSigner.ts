/**
 * Which key signed an APK (SC2): the Dev-Preview APK must never be signed with the release key (the
 * shortcut of storing the old shared keystore under the new ANDROID_DEV_* names would undo SC2
 * silently), and a published release APK must be signed with exactly that key. Input is the output of
 * `apksigner verify --print-certs`. Erasable TypeScript, used by `../apk-signer-check.mjs`.
 */
import type { Finding } from './audit';

/**
 * SHA-256 of the release signing certificate: public, it ships inside every published `Nemo.apk`
 * (`keytool -printcert -jarfile Nemo.apk`). Changes only if the release keystore ever changes, which
 * must not happen (installed apps could no longer be updated).
 */
export const STABLE_APK_CERT_SHA256 =
  '8834e6267eb34f076f13bfd4036272a58fb9554a157b92cf010205d9687b3630';

export function signerDigests(printCerts: string): string[] {
  return [...printCerts.matchAll(/certificate SHA-256 digest:\s*([0-9a-fA-F:]+)/g)].map((m) =>
    m[1]!.replace(/:/g, '').toLowerCase(),
  );
}

export function checkApkSigner(printCerts: string, channel: 'dev' | 'release'): Finding[] {
  const file = 'APK signature';
  const digests = signerDigests(printCerts);
  if (digests.length === 0) return [{ file, rule: 'no-signer' }];
  if (channel === 'dev') {
    return digests.includes(STABLE_APK_CERT_SHA256)
      ? [{ file, rule: 'dev-apk-signed-with-release-key' }]
      : [];
  }
  return digests.every((d) => d === STABLE_APK_CERT_SHA256)
    ? []
    : [{ file, rule: 'release-apk-wrong-key' }];
}
