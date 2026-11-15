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
  /**
   * `true` when a non-empty value is stored under `name` (exactly when `get` would return one). Only a yes/no: the
   * value never leaves the store, not even its length. Use this wherever the question is "is it set?".
   */
  has(name: string): Promise<boolean>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}
