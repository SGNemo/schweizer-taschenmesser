import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hardenManifest, withCamera, withLanWatch } from './androidManifest';

// Shape of the Tauri 2 template (placeholder for cleartext, no allowBackup).
const template = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.app"
        android:usesCleartextTraffic="\${usesCleartextTraffic}">
        <activity android:name=".MainActivity" android:exported="true" />
    </application>
</manifest>
`;

describe('Android manifest hardening', () => {
  it('adds allowBackup="false" when the template does not set it', () => {
    const { xml, cleartext } = hardenManifest(template);
    expect(xml).toContain('<application android:allowBackup="false"');
    expect(xml.match(/allowBackup/g)).toHaveLength(1);
    expect(xml).toContain('android:icon="@mipmap/ic_launcher"');
    expect(cleartext).toBe('${usesCleartextTraffic}');
  });

  it('replaces a "true" and keeps a "false"', () => {
    const on = template.replace('<application', '<application android:allowBackup="true"');
    expect(hardenManifest(on).xml).not.toContain('allowBackup="true"');
    expect(hardenManifest(on).xml.match(/allowBackup/g)).toHaveLength(1);
    const off = template.replace('<application', '<application android:allowBackup="false"');
    expect(hardenManifest(off).xml.match(/allowBackup="false"/g)).toHaveLength(1);
  });

  it('is idempotent and leaves the rest of the file alone', () => {
    const once = hardenManifest(template).xml;
    expect(hardenManifest(once).xml).toBe(once);
    expect(once.replace(' android:allowBackup="false"', '')).toBe(template);
  });

  it('reports a literal cleartext value and fails without an <application>', () => {
    const literal = template.replace('${usesCleartextTraffic}', 'true');
    expect(hardenManifest(literal).cleartext).toBe('true');
    expect(() => hardenManifest('<manifest></manifest>')).toThrow(/no <application>/);
  });
});

describe('CI wiring', () => {
  const wf = (f: string) =>
    readFileSync(resolve(__dirname, '../../../.github/workflows', f), 'utf8');
  it('both Android builds run the manifest step right after the init', () => {
    for (const f of ['release.yml', 'dev-preview.yml']) {
      const text = wf(f);
      const init = text.indexOf('tauri android init');
      const step = text.indexOf('node scripts/android-manifest.mjs');
      const build = text.indexOf('tauri android build');
      expect(init, f).toBeGreaterThan(-1);
      expect(step, f).toBeGreaterThan(init);
      expect(step, f).toBeLessThan(build);
    }
  });
});

describe('camera for in-app QR scanning', () => {
  it('declares CAMERA and an optional camera feature before <application>, once', () => {
    const once = withCamera(hardenManifest(template).xml);
    expect(once).toContain('<uses-permission android:name="android.permission.CAMERA" />');
    expect(once).toContain('android:name="android.hardware.camera.any" android:required="false"');
    expect(once.indexOf('android.permission.CAMERA')).toBeLessThan(once.indexOf('<application'));
    expect(withCamera(once)).toBe(once);
  });

  it('declares the two normal permissions of home-network sync once, before <application>', () => {
    const once = withLanWatch(withCamera(hardenManifest(template).xml));
    for (const name of ['ACCESS_NETWORK_STATE', 'CHANGE_WIFI_MULTICAST_STATE']) {
      expect(once).toContain(`<uses-permission android:name="android.permission.${name}" />`);
      expect(once.indexOf(`android.permission.${name}`)).toBeLessThan(once.indexOf('<application'));
      expect(once.match(new RegExp(name, 'g'))).toHaveLength(1);
    }
    expect(withLanWatch(once)).toBe(once);
    expect(once).not.toMatch(/LOCATION/);
  });

  it('keeps a network permission another plugin already declared and refuses location', () => {
    const declared = template.replace(
      '<application',
      '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <application',
    );
    const out = withLanWatch(declared);
    expect(out.match(/ACCESS_NETWORK_STATE/g)).toHaveLength(1);
    expect(out).toContain('CHANGE_WIFI_MULTICAST_STATE');
    const located = template.replace(
      '<application',
      '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <application',
    );
    expect(() => withLanWatch(located)).toThrow(/location/);
  });
});
