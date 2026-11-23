import { describe, expect, it } from 'vitest';
import { DATA_EXTRACTION_RULES, withDataExtractionRules } from './androidManifest';

// NS5 (launch review 2026-11): `allowBackup="false"` stops cloud backup, but from Android 12 on a
// device-to-device transfer ignores it and can copy the app's database. `dataExtractionRules`
// excludes every domain from both.
const template = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:allowBackup="false"
        android:label="@string/app_name">
        <activity android:name=".MainActivity" android:exported="true" />
    </application>
</manifest>
`;

describe('Android data extraction rules', () => {
  it('points the application at rules that exclude everything, once', () => {
    const out = withDataExtractionRules(template);
    expect(out).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(withDataExtractionRules(out)).toBe(out);
    const replaced = withDataExtractionRules(
      template.replace('<application', '<application android:dataExtractionRules="@xml/other"'),
    );
    expect(replaced.match(/dataExtractionRules=/g)).toHaveLength(1);
    expect(replaced).toContain('"@xml/data_extraction_rules"');
  });

  it('the rules exclude every domain from cloud backup and from device transfer', () => {
    for (const section of ['cloud-backup', 'device-transfer']) {
      const body = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`).exec(
        DATA_EXTRACTION_RULES,
      )?.[1];
      expect(body, section).toBeDefined();
      for (const domain of ['root', 'file', 'database', 'sharedpref', 'external'])
        expect(body, `${section} ${domain}`).toContain(`<exclude domain="${domain}" path="." />`);
      expect(body, section).not.toContain('<include');
    }
  });
});
