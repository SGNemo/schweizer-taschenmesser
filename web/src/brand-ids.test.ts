import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UPDATER_PORTABLE_ASSET } from '../scripts/lib/latestJson';
import { RELEASE_ASSETS } from '../scripts/lib/releaseAssets';

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

describe('Dev-Preview flavor', () => {
  const stable = json('src-tauri/tauri.conf.json');
  const dev = JSON.parse(read('src-tauri/tauri.dev.conf.json')) as Record<string, unknown>;

  it('only overrides name and identifier; the identifier is the stable one plus ".dev"', () => {
    expect(
      Object.keys(dev)
        .filter((k) => k !== '$schema')
        .sort(),
    ).toEqual(['identifier', 'productName']);
    expect(dev.identifier).toBe(`${stable.identifier}.dev`);
    expect(dev.productName).toBe('Nemo Dev');
  });

  it('cannot touch the updater key or endpoint of the stable app', () => {
    expect(JSON.stringify(dev)).not.toMatch(/updater|pubkey|endpoints/);
  });
});

describe('internal identifiers stay unchanged', () => {
  const tauri = json('src-tauri/tauri.conf.json');

  it('Tauri identifier and updater endpoint', () => {
    expect(tauri.identifier).toBe('io.github.sgnemo.taschenmesser');
    expect(tauri.plugins.updater.endpoints).toEqual([
      'https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/latest.json',
    ]);
    // The full public key: a different key would make every installed app reject the next update.
    expect(tauri.plugins.updater.pubkey).toBe(
      'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDNDREU2NEMxNEY0OTI3N0UKUldSK0owbFB3V1RlUEVQL2lDS28rdk1ud3BTdEU1bElzQjlOQWVCTUpINVZaL24yMWpuV2lDREIK',
    );
  });

  it('the product name and window titles are the new name', () => {
    expect(tauri.productName).toBe('Nemo');
    expect(tauri.app.windows[0]!.title).toBe('Nemo');
    expect(json('src-tauri/tauri.windows.conf.json').app.windows[0]!.title).toBe('Nemo');
  });

  it('IndexedDB name, storage keys and backup format', () => {
    expect(read('src/core/db/db.ts')).toContain("DB_NAME = 'taschenmesser'");
    // The service worker opens the database by name (no import, it must not pull Dexie in).
    expect(read('src/sw.ts')).toContain("indexedDB.open('taschenmesser')");
    expect(read('src/stores/ui.ts')).toContain("THEME_KEY = 'tm-theme'");
    expect(read('src/stores/ui.ts')).toContain("ACCENT_KEY = 'tm-accent'");
    // Inline scripts read the same keys before the app boots.
    for (const html of ['index.html', 'capture.html']) {
      expect(read(html), html).toContain("localStorage.getItem('tm-theme')");
    }
    expect(read('index.html')).toContain("localStorage.getItem('tm-accent')");
    expect(read('src/tools/calc/Tool.tsx')).toContain("KEY = 'tm-calc-history'");
    expect(read('src/tools/currency/Tool.tsx')).toContain("CACHE = 'tm-currency-rates'");
    expect(read('src/quickCapture/device.ts')).toContain("KEY = 'tm-quick-capture'");
    expect(read('src/core/backup/backup.ts')).toContain("BACKUP_FORMAT = 'taschenmesser-backup'");
    expect(read('src/modules/accounts/backup.ts')).toContain(
      "BACKUP_FORMAT = 'taschenmesser-vault-backup'",
    );
    expect(read('src/core/sync/service.ts')).toContain("'taschenmesser-sync'");
    // Encrypted backups: file format id and the payload name bound as AEAD associated data.
    expect(read('src/core/backup/encrypted.ts')).toContain(
      "ENCRYPTED_BACKUP_FORMAT = 'taschenmesser-backup-encrypted'",
    );
    expect(read('src/core/backup/encrypted.ts')).toContain(
      "PAYLOAD_FORMAT = 'taschenmesser-backup-payload'",
    );
    // The installed PWA is identified by these; a change would install a second app.
    expect(read('vite.config.ts')).toMatch(/id: '\/',\s*start_url: '\/'/);
  });

  it('local API and MCP: token prefix, server name, environment variables', () => {
    expect(read('src/core/localapi/config.ts')).toContain("TOKEN_PREFIX = 'tm_'");
    expect(read('../mcp/src/config.ts')).toMatch(/\^tm_\[A-Za-z0-9_-\]\{16,250\}\$/);
    expect(read('../mcp/src/config.ts')).toContain('TASCHENMESSER_TOKEN');
    expect(read('../mcp/src/config.ts')).toContain('TASCHENMESSER_URL');
    expect(read('../mcp/src/server.ts')).toContain("name: 'taschenmesser'");
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
    for (const plugin of ['apk-installer', 'secure-store', 'share-intent']) {
      const pkg = `io.github.sgnemo.taschenmesser.${plugin.replace('-', '')}`;
      expect(read(`src-tauri/plugins/${plugin}/android/build.gradle.kts`), plugin).toContain(
        `namespace = "${pkg}"`,
      );
      expect(read(`src-tauri/plugins/${plugin}/src/mobile.rs`), plugin).toContain(
        `ANDROID_PACKAGE: &str = "${pkg}"`,
      );
    }
    // The share intent filter is merged into the app's launcher activity by its full class name. The
    // activity lives in the app's package (= identifier = application id), so `${applicationId}` is
    // io.github.sgnemo.taschenmesser for the stable app and the same with `.dev` for the Dev-Preview.
    expect(read('src-tauri/plugins/share-intent/android/src/main/AndroidManifest.xml')).toContain(
      'android:name="${applicationId}.MainActivity"',
    );
    expect(read('src-tauri/tauri.conf.json')).toContain(
      '"identifier": "io.github.sgnemo.taschenmesser"',
    );
  });

  it('Cargo package names and release keystore alias', () => {
    expect(read('src-tauri/Cargo.toml')).toMatch(/^name = "taschenmesser"$/m);
    expect(read('src-tauri/Cargo.toml')).toMatch(/^name = "taschenmesser_lib"$/m);
    expect(read('src-tauri/src/main.rs')).toContain('taschenmesser_lib::run');
    expect(read('src-tauri/crates/local-api/Cargo.toml')).toContain(
      'name = "taschenmesser-local-api"',
    );
    expect(read('scripts/keys.mjs')).toContain("'taschenmesser',");
    expect(read('src/core/update/github.ts')).toContain("REPO = 'SGNemo/schweizer-taschenmesser'");
  });

  it('updater: latest.json points at the Nemo asset; clients still accept the legacy name', () => {
    // Releases no longer carry the Taschenmesser-* copies. Clients ≥ 0.3.0 accept both names
    // (update.rs, kept on purpose); installations ≤ 0.2.x cannot self-update any more.
    expect(UPDATER_PORTABLE_ASSET).toBe('Nemo-Portable.exe');
    expect(RELEASE_ASSETS).toContain(UPDATER_PORTABLE_ASSET);
    expect(RELEASE_ASSETS.join(' ')).not.toContain('Taschenmesser');
    expect(read('src-tauri/src/update.rs')).toContain(
      'PORTABLE_ASSETS: [&str; 2] = ["Nemo-Portable.exe", "Taschenmesser-Portable.exe"]',
    );
    expect(read('src-tauri/src/update.rs')).toContain(
      'RELEASES_PREFIX: &str = "/SGNemo/schweizer-taschenmesser/releases/"',
    );
  });
});
