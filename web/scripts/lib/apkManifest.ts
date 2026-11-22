/**
 * Check of the merged manifest inside the built APK (NS4): what Android really installs, after Gradle
 * merged the app manifest with every library and plugin manifest. `scripts/android-manifest.mjs` only
 * edits the app's own manifest before the build; this check reads the result (`apkanalyzer manifest
 * print`) and compares it with an allow-list kept here, so a new permission or exported component from
 * a dependency update fails the build until someone reviews it and adds it.
 * Erasable TypeScript, used by `../apk-manifest-check.mjs` and its unit test.
 */
import type { Finding } from './audit';

export interface MergedManifest {
  permissions: string[];
  /** Permissions the app itself declares (`<permission>`), with their protection level. */
  declared: { name: string; protectionLevel: string }[];
  /** Attributes of `<application>`. */
  application: Record<string, string>;
  /**
   * Components another app can start or bind (explicitly exported, or with an intent filter and no
   * `exported`), as `name` or `name (permission)` when `android:permission` guards it. A provider's
   * `readPermission`/`writePermission` is not read: such a provider is listed unguarded (fails closed).
   */
  exported: string[];
}

export interface ManifestAllowList {
  permissions: readonly string[];
  exported: readonly string[];
}

/**
 * Taken from the merged manifest of the release APK (dry run of `release.yml` on 2026-11-22, printed
 * by the check step) and reviewed entry by entry. Adding or changing an entry is a security review:
 * say in the PR why the app needs it. Exported components carry their guarding permission.
 */
export const APK_ALLOW_LIST: ManifestAllowList = {
  permissions: [
    'android.permission.INTERNET', // sync, AI providers, update checks
    'android.permission.CAMERA', // QR scanning (androidManifest.ts withCamera)
    'android.permission.ACCESS_NETWORK_STATE', // home-network sync: Wi-Fi callback (withLanWatch)
    'android.permission.CHANGE_WIFI_MULTICAST_STATE', // home-network sync: hub search
    'android.permission.REQUEST_INSTALL_PACKAGES', // plugins/apk-installer: in-app update
    'android.permission.RECEIVE_BOOT_COMPLETED', // tauri-plugin-notification: reminders after a restart
    'android.permission.WAKE_LOCK', // tauri-plugin-notification: deliver a scheduled reminder
    'android.permission.POST_NOTIFICATIONS', // reminders
    'android.permission.USE_BIOMETRIC', // plugins/secure-store: biometric unlock
    'android.permission.USE_FINGERPRINT', // androidx.biometric, for Android versions before 9
    // androidx.core: signature-level permission of the app itself for its non-exported receivers
    'io.github.sgnemo.taschenmesser.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
  ],
  exported: [
    'io.github.sgnemo.taschenmesser.MainActivity', // launcher, share target, nemo:// links
    // Quick Settings tile "Erfassen"; only the system can bind it
    'io.github.sgnemo.taschenmesser.shareintent.CaptureTileService (android.permission.BIND_QUICK_SETTINGS_TILE)',
    // androidx.profileinstaller; only shell/adb (DUMP) can send to it
    'androidx.profileinstaller.ProfileInstallReceiver (android.permission.DUMP)',
  ],
};

/** Never acceptable, whatever the list says: home-network sync must not read the Wi-Fi name. */
const NEVER = /^android\.permission\.ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION$/;

const COMPONENTS = new Set(['activity', 'activity-alias', 'service', 'receiver', 'provider']);
const PERMISSION_TAGS = new Set([
  'uses-permission',
  'uses-permission-sdk-23',
  'uses-permission-sdk-m',
]);

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
}

/** A small reader for the machine-written XML `apkanalyzer` prints; throws when it is not a manifest. */
export function parseManifest(xml: string): MergedManifest {
  const result: MergedManifest = { permissions: [], declared: [], application: {}, exported: [] };
  const stack: { tag: string; attrs: Record<string, string>; filter: boolean }[] = [];
  let sawManifest = false;
  let sawApplication = false;
  const close = (el: { tag: string; attrs: Record<string, string>; filter: boolean }) => {
    if (!COMPONENTS.has(el.tag) || stack.at(-1)?.tag !== 'application') return;
    const exported = el.attrs['android:exported'];
    if (exported === 'true' || (exported === undefined && el.filter)) {
      const name = el.attrs['android:name'] ?? '(unnamed)';
      const guard = el.attrs['android:permission'];
      result.exported.push(guard ? `${name} (${guard})` : name);
    }
  };
  for (const m of xml.matchAll(/<(\/?)([A-Za-z][\w.-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g)) {
    const [, closing, tag, raw, selfClosing] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (closing) {
      const el = stack.pop();
      if (!el || el.tag !== tag) throw new Error(`unbalanced </${tag}>`);
      close(el);
      continue;
    }
    const attrs = attributes(raw);
    if (tag === 'manifest') sawManifest = true;
    if (tag === 'application' && stack.at(-1)?.tag === 'manifest') {
      sawApplication = true;
      result.application = attrs;
    }
    if (PERMISSION_TAGS.has(tag) && stack.at(-1)?.tag === 'manifest' && attrs['android:name']) {
      result.permissions.push(attrs['android:name']);
    }
    if (tag === 'permission' && stack.at(-1)?.tag === 'manifest' && attrs['android:name']) {
      result.declared.push({
        name: attrs['android:name'],
        protectionLevel: attrs['android:protectionLevel'] ?? 'normal',
      });
    }
    if (tag === 'intent-filter') {
      const owner = stack.at(-1);
      if (owner) owner.filter = true;
    }
    const el = { tag, attrs, filter: false };
    if (selfClosing) close(el);
    else stack.push(el);
  }
  if (!sawManifest || !sawApplication || stack.length > 0)
    throw new Error('not a complete manifest');
  return result;
}

const FILE = 'AndroidManifest.xml';

export function checkMergedManifest(
  xml: string,
  allow: ManifestAllowList = APK_ALLOW_LIST,
): Finding[] {
  let m: MergedManifest;
  try {
    m = parseManifest(xml);
  } catch {
    return [{ file: FILE, rule: 'manifest-unreadable' }];
  }
  const findings: Finding[] = [];
  for (const p of new Set(m.permissions)) {
    if (NEVER.test(p) || !allow.permissions.includes(p)) {
      findings.push({ file: FILE, rule: 'permission-not-allowed', detail: p });
    }
  }
  for (const c of m.exported) {
    if (!allow.exported.includes(c))
      findings.push({ file: FILE, rule: 'exported-not-allowed', detail: c });
  }
  // Another app must not be able to hold a permission the app declares for itself.
  for (const p of m.declared) {
    const level = p.protectionLevel;
    // apkanalyzer prints the name; a raw value is the flag word (base 0x2 = signature)
    const signature = /^0x/i.test(level)
      ? (Number.parseInt(level, 16) & 0xf) === 2
      : level.split('|').includes('signature');
    if (!signature) {
      findings.push({ file: FILE, rule: 'permission-not-signature', detail: p.name });
    }
  }
  const app = m.application;
  if (app['android:allowBackup'] !== 'false') findings.push({ file: FILE, rule: 'backup-allowed' });
  if (app['android:usesCleartextTraffic'] === 'true')
    findings.push({ file: FILE, rule: 'cleartext-allowed' });
  if (app['android:debuggable'] === 'true') findings.push({ file: FILE, rule: 'debuggable' });
  if (app['android:testOnly'] === 'true') findings.push({ file: FILE, rule: 'test-only' });
  // A network security config can allow cleartext per domain; none is expected.
  if (app['android:networkSecurityConfig'] !== undefined) {
    findings.push({ file: FILE, rule: 'network-security-config' });
  }
  return findings;
}
