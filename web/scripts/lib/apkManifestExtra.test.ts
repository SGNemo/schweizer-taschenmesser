import { describe, expect, it } from 'vitest';
import { checkMergedManifest } from './apkManifest';

const NS = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const xml = (manifestExtra: string, appExtra = '') => `<manifest ${NS} package="io.example">
  ${manifestExtra}
  <application android:allowBackup="false" ${appExtra}></application>
</manifest>`;
const allow = { permissions: [], exported: [] };

describe('merged APK manifest – declared permissions and test builds', () => {
  it('a permission the app declares must be signature-level', () => {
    expect(
      checkMergedManifest(
        xml('<permission android:name="io.example.P" android:protectionLevel="signature" />'),
        allow,
      ),
    ).toEqual([]);
    expect(
      checkMergedManifest(
        xml('<permission android:name="io.example.P" android:protectionLevel="normal" />'),
        allow,
      ),
    ).toEqual([
      { file: 'AndroidManifest.xml', rule: 'permission-not-signature', detail: 'io.example.P' },
    ]);
  });

  it('a raw protection level is read as flags; a missing one means normal', () => {
    const rules = (attr: string) =>
      checkMergedManifest(xml(`<permission android:name="io.example.P" ${attr} />`), allow).map(
        (f) => f.rule,
      );
    expect(rules('android:protectionLevel="0x2"')).toEqual([]);
    expect(rules('android:protectionLevel="0x12"')).toEqual([]); // signature|privileged
    expect(rules('android:protectionLevel="0x1"')).toEqual(['permission-not-signature']);
    expect(rules('')).toEqual(['permission-not-signature']);
  });

  it('a test-only build fails', () => {
    expect(
      checkMergedManifest(xml('', 'android:testOnly="true"'), allow).map((f) => f.rule),
    ).toEqual(['test-only']);
  });
});
