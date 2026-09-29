/**
 * Device-local storage for small secrets (API keys). Never synced, never part of a backup.
 *
 * `protection` says what protects the value at rest:
 *  - `device-key`: AES-256-GCM with a non-extractable WebCrypto key kept next to the data. A copy of
 *    the database file (backup, disk image, another profile) is useless without the browser's key
 *    store – but code running inside this app/profile can still decrypt. It is not a substitute for an
 *    OS keystore.
 *  - `os-keystore`: Windows Credential Manager / Android Keystore (planned, step 11b).
 */
export interface SecretStore {
  readonly protection: 'device-key' | 'os-keystore';
  get(name: string): Promise<string | undefined>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}
