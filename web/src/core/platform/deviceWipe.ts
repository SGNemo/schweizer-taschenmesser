/**
 * Native part of "Alle Daten auf diesem Gerät löschen" (apps only): what the app keeps outside the
 * web view's database. The browser has none, so there it is unsupported.
 */

/** Step ids the native side reports (`web/src-tauri/src/device_wipe.rs`). */
export type DeviceWipeStep =
  | 'lan-hub'
  | 'lan-client'
  | 'exchange-inbox'
  | 'downloads'
  | 'torrent'
  | 'pc-care'
  | 'panic-log'
  | 'native-messaging'
  | 'models'
  /** Web side only: the native part threw or did not answer in time. */
  | 'native';

export interface DeviceWipeReport {
  /** Steps that did not finish; the reset goes on anyway. */
  failed: DeviceWipeStep[];
  /** Steps that left something on purpose (`pc-care`: changes that can still be undone). */
  kept: DeviceWipeStep[];
}

export interface DeviceWipeService {
  readonly supported: boolean;
  /** `models`: also remove downloaded local AI models (desktop; the user ticks it). */
  wipe(options: { models: boolean }): Promise<DeviceWipeReport>;
}

export const noDeviceWipe: DeviceWipeService = {
  supported: false,
  wipe: () => Promise.resolve({ failed: [], kept: [] }),
};
