/**
 * Hardening of the generated Android manifest (`src-tauri/gen/android/app/src/main/AndroidManifest.xml`,
 * created by `tauri android init` in CI). The Tauri template does not set `android:allowBackup`, and
 * Android's default is `true`: the app's data (the WebView database) would be uploaded to the user's
 * Google backup and restored on a new device. Nemo has its own encrypted backup, so Auto Backup is
 * switched off explicitly. Cleartext traffic is only reported, not changed: plain-HTTP sync in the
 * home network is a product decision (docs/decisions/security.md).
 * Erasable TypeScript, imported by `../android-manifest.mjs`.
 */

const APPLICATION_TAG = /<application\b[^>]*>/;

export interface ManifestResult {
  xml: string;
  /** What the manifest says about cleartext traffic (a literal, a `${placeholder}`, or undefined). */
  cleartext: string | undefined;
}

/** Sets `android:allowBackup="false"` on `<application>` (replacing any value) and verifies it. */
export function hardenManifest(xml: string): ManifestResult {
  const tag = APPLICATION_TAG.exec(xml)?.[0];
  if (!tag) throw new Error('AndroidManifest.xml: no <application> element');
  const without = tag.replace(/\s+android:allowBackup="[^"]*"/, '');
  const hardened = without.replace(/^<application\b/, '<application android:allowBackup="false"');
  const out = xml.replace(tag, hardened);
  // Verify what was written, not what was intended.
  const check = APPLICATION_TAG.exec(out)?.[0] ?? '';
  if (
    (check.match(/android:allowBackup="/g) ?? []).length !== 1 ||
    !check.includes('android:allowBackup="false"')
  )
    throw new Error('AndroidManifest.xml: allowBackup is not "false" after hardening');
  return { xml: out, cleartext: /android:usesCleartextTraffic="([^"]*)"/.exec(check)?.[1] };
}
