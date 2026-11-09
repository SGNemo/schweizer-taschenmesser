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

const CAMERA = '<uses-permission android:name="android.permission.CAMERA" />';
const CAMERA_FEATURE =
  '<uses-feature android:name="android.hardware.camera.any" android:required="false" />';

/**
 * The camera for scanning QR codes in the app ("Mit PC koppeln", the QR tool, the pantry barcode):
 * the WebView's `getUserMedia` asks Android for CAMERA at that moment, which only works when the
 * manifest declares it. Optional feature, so devices without a camera can still install. Idempotent.
 */
export function withCamera(xml: string): string {
  const parts = [CAMERA, CAMERA_FEATURE].filter(
    (line) => !xml.includes(/android:name="[^"]+"/.exec(line)?.[0] ?? line),
  );
  if (parts.length === 0) return xml;
  const tag = APPLICATION_TAG.exec(xml);
  if (!tag) throw new Error('AndroidManifest.xml: no <application> element');
  const out = xml.replace(tag[0], `${parts.join('\n    ')}\n    ${tag[0]}`);
  if (!out.includes('android.permission.CAMERA'))
    throw new Error('AndroidManifest.xml: CAMERA permission missing after adding it');
  return out;
}

const NETWORK_PERMISSIONS = [
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />',
];

/** Never in the manifest for home-network sync: reading the Wi-Fi name would need these. */
const LOCATION = /android\.permission\.ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION/;

/**
 * Home-network sync on the phone (`src-tauri/plugins/lan-watch`): the Wi-Fi callback needs
 * ACCESS_NETWORK_STATE, the multicast lock for the hub search CHANGE_WIFI_MULTICAST_STATE. Both are
 * normal permissions (granted at install, no prompt). No location permission and no SSID: the
 * check fails if a location permission shows up. Idempotent.
 */
export function withLanWatch(xml: string): string {
  const parts = NETWORK_PERMISSIONS.filter(
    (line) => !xml.includes(/android:name="[^"]+"/.exec(line)?.[0] ?? line),
  );
  let out = xml;
  if (parts.length > 0) {
    const tag = APPLICATION_TAG.exec(xml);
    if (!tag) throw new Error('AndroidManifest.xml: no <application> element');
    out = xml.replace(tag[0], `${parts.join('\n    ')}\n    ${tag[0]}`);
  }
  for (const name of ['ACCESS_NETWORK_STATE', 'CHANGE_WIFI_MULTICAST_STATE'])
    if (!out.includes(`android.permission.${name}`))
      throw new Error(`AndroidManifest.xml: ${name} missing after adding it`);
  if (LOCATION.test(out))
    throw new Error(
      'AndroidManifest.xml: a location permission is declared (home-network sync never needs one)',
    );
  return out;
}
