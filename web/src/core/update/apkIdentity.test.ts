import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// S13 way D (launch review 2026-11): Android checks the certificate only for an APK with this app's
// package name, so the installer plugin must refuse an APK of another app before the system
// installer opens. The Kotlin code cannot run here; its order is pinned on the source text.
const plugin = readFileSync(
  new URL(
    '../../../src-tauri/plugins/apk-installer/android/src/main/java/io/github/sgnemo/taschenmesser/apkinstaller/ApkInstallerPlugin.kt',
    import.meta.url,
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('APK installer: only this app', () => {
  it("compares the file's package name with the running app before opening the installer", () => {
    const install = plugin.slice(plugin.indexOf('fun install('));
    const check = install.indexOf('getPackageArchiveInfo(file.absolutePath');
    const compare = install.indexOf('if (archivePackage != activity.packageName)');
    const reject = install.indexOf('invoke.reject("wrong-app:');
    const open = install.indexOf('Intent.ACTION_VIEW');
    expect(check).toBeGreaterThan(-1);
    expect(compare).toBeGreaterThan(check);
    expect(reject).toBeGreaterThan(compare);
    expect(open).toBeGreaterThan(reject);
  });
});
