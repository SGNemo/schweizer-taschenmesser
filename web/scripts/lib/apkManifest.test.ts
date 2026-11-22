import { describe, expect, it } from 'vitest';
import { checkMergedManifest, parseManifest } from './apkManifest';

const NS = 'xmlns:android="http://schemas.android.com/apk/res/android"';

/** A merged manifest as `apkanalyzer manifest print` shows it (invented, trimmed). */
function manifest({
  permissions = ['android.permission.INTERNET'],
  application = 'android:allowBackup="false"',
  components = '',
}: { permissions?: string[]; application?: string; components?: string } = {}): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest ${NS} package="io.example.app" android:versionCode="1">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36" />
${permissions.map((p) => `  <uses-permission android:name="${p}" />`).join('\n')}
  <application android:label="App" ${application}>
    <activity android:name="io.example.app.MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
${components}
  </application>
</manifest>`;
}

const allow = {
  permissions: ['android.permission.INTERNET'],
  exported: ['io.example.app.MainActivity'],
};

describe('merged APK manifest (NS4)', () => {
  it('parses permissions, application flags and exported components', () => {
    const m = parseManifest(
      manifest({
        permissions: ['android.permission.INTERNET', 'android.permission.CAMERA'],
        components:
          '    <receiver android:name="x.R" android:exported="false" />\n    <service android:name="x.S"><intent-filter><action android:name="a" /></intent-filter></service>',
      }),
    );
    expect(m.permissions).toEqual(['android.permission.INTERNET', 'android.permission.CAMERA']);
    expect(m.application['android:allowBackup']).toBe('false');
    // no explicit exported + intent filter = exported (the old Android default)
    expect(m.exported).toEqual(['io.example.app.MainActivity', 'x.S']);
  });

  it('passes a manifest that matches the allow-list', () => {
    expect(checkMergedManifest(manifest(), allow)).toEqual([]);
  });

  it('fails on a permission that is not on the list', () => {
    expect(
      checkMergedManifest(
        manifest({
          permissions: ['android.permission.INTERNET', 'android.permission.READ_CONTACTS'],
        }),
        allow,
      ),
    ).toEqual([
      {
        file: 'AndroidManifest.xml',
        rule: 'permission-not-allowed',
        detail: 'android.permission.READ_CONTACTS',
      },
    ]);
  });

  it('fails on an exported component that is not on the list', () => {
    expect(
      checkMergedManifest(
        manifest({ components: '    <provider android:name="x.Files" android:exported="true" />' }),
        allow,
      ),
    ).toEqual([{ file: 'AndroidManifest.xml', rule: 'exported-not-allowed', detail: 'x.Files' }]);
  });

  it('fails on cleartext, backup, debuggable and a network security config', () => {
    const rules = (application: string) =>
      checkMergedManifest(manifest({ application }), allow).map((f) => f.rule);
    expect(rules('android:allowBackup="false" android:usesCleartextTraffic="true"')).toEqual([
      'cleartext-allowed',
    ]);
    expect(rules('android:allowBackup="true"')).toEqual(['backup-allowed']);
    expect(rules('')).toEqual(['backup-allowed']);
    expect(rules('android:allowBackup="false" android:debuggable="true"')).toEqual(['debuggable']);
    expect(rules('android:allowBackup="false" android:networkSecurityConfig="@xml/nsc"')).toEqual([
      'network-security-config',
    ]);
    expect(rules('android:allowBackup="false" android:usesCleartextTraffic="false"')).toEqual([]);
  });

  it('an exported component is listed with the permission that guards it', () => {
    const guarded =
      '    <receiver android:name="x.R" android:exported="true" android:permission="android.permission.DUMP" />';
    expect(parseManifest(manifest({ components: guarded })).exported).toContain(
      'x.R (android.permission.DUMP)',
    );
    // listed with its guard: passes; the same name without the guard fails
    const withGuard = { ...allow, exported: [...allow.exported, 'x.R (android.permission.DUMP)'] };
    expect(checkMergedManifest(manifest({ components: guarded }), withGuard)).toEqual([]);
    expect(
      checkMergedManifest(
        manifest({ components: '    <receiver android:name="x.R" android:exported="true" />' }),
        withGuard,
      ).map((f) => f.detail),
    ).toEqual(['x.R']);
  });

  it('a location permission is never allowed, whatever the list says', () => {
    expect(
      checkMergedManifest(manifest({ permissions: ['android.permission.ACCESS_FINE_LOCATION'] }), {
        ...allow,
        permissions: ['android.permission.ACCESS_FINE_LOCATION'],
      }).map((f) => f.rule),
    ).toEqual(['permission-not-allowed']);
  });

  it('an unreadable manifest is a finding', () => {
    expect(checkMergedManifest('not xml', allow).map((f) => f.rule)).toEqual([
      'manifest-unreadable',
    ]);
  });
});
