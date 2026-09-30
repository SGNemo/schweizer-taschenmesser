import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The visible name is "Nemo", but these identifiers must never change: a different value would make
 * Android treat an update as a new app, detach the app from its stored data or break the updater.
 * If one of these assertions fails, do not "fix" the test – revert the change (see docs/DECISIONS.md).
 */
const web = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(web, path), 'utf8');
interface TauriConfig {
  identifier: string;
  productName: string;
  app: { windows: { title: string }[] };
  plugins: { updater: { endpoints: string[]; pubkey: string } };
}
const json = (path: string) => JSON.parse(read(path)) as TauriConfig;

describe('internal identifiers stay unchanged', () => {
  const tauri = json('src-tauri/tauri.conf.json');

  it('Tauri identifier and updater endpoint', () => {
    expect(tauri.identifier).toBe('io.github.sgnemo.taschenmesser');
    expect(tauri.plugins.updater.endpoints).toEqual([
      'https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json',
    ]);
    expect(tauri.plugins.updater.pubkey).toMatch(/^dW50cnVzdGVk/);
  });

  it('the product name and window titles are the new name', () => {
    expect(tauri.productName).toBe('Nemo');
    expect(tauri.app.windows[0]!.title).toBe('Nemo');
    expect(json('src-tauri/tauri.windows.conf.json').app.windows[0]!.title).toBe('Nemo');
  });

  it('IndexedDB name, storage keys and backup format', () => {
    expect(read('src/core/db/db.ts')).toContain("DB_NAME = 'taschenmesser'");
    expect(read('src/stores/ui.ts')).toContain("THEME_KEY = 'tm-theme'");
    expect(read('src/core/backup/backup.ts')).toContain("BACKUP_FORMAT = 'taschenmesser-backup'");
    expect(read('src/modules/accounts/backup.ts')).toContain(
      "BACKUP_FORMAT = 'taschenmesser-vault-backup'",
    );
    expect(read('src/core/sync/service.ts')).toContain("'taschenmesser-sync'");
  });

  it('crypto context strings (changing them would make existing data undecryptable)', () => {
    expect(read('src/core/crypto/keychain.ts')).toContain("'taschenmesser-vault-key-check'");
    expect(read('src/core/crypto/passwordBlob.ts')).toContain("'taschenmesser/password-blob/v1'");
    expect(read('src/core/sync/crypto.ts')).toContain("'taschenmesser-vault-v1'");
    expect(read('src/core/secrets/deviceKey.ts')).toContain('taschenmesser/secret/');
  });

  it('native plugins: keystore aliases, service name, Android packages', () => {
    const kt = read(
      'src-tauri/plugins/secure-store/android/src/main/java/io/github/sgnemo/taschenmesser/securestore/SecureStorePlugin.kt',
    );
    expect(kt).toContain('"taschenmesser.secrets.v1"');
    expect(kt).toContain('"taschenmesser.biometric.v1"');
    expect(kt).toContain('"taschenmesser_secure_store"');
    expect(read('src-tauri/plugins/secure-store/src/models.rs')).toContain(
      '"io.github.sgnemo.taschenmesser"',
    );
    expect(read('src-tauri/plugins/apk-installer/android/build.gradle.kts')).toContain(
      'io.github.sgnemo.taschenmesser.apkinstaller',
    );
  });

  it('Cargo package names and release keystore alias', () => {
    expect(read('src-tauri/Cargo.toml')).toMatch(/^name = "taschenmesser"$/m);
    expect(read('src-tauri/crates/local-api/Cargo.toml')).toContain(
      'name = "taschenmesser-local-api"',
    );
    expect(read('scripts/keys.mjs')).toContain("'taschenmesser',");
    expect(read('src/core/update/github.ts')).toContain("REPO = 'SGNemo/schweizer-taschenmesser'");
  });
});
