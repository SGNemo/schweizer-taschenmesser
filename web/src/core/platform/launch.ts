/**
 * Desktop: what a start of the app was given (a `magnet:` link or a `.torrent` file path, via the
 * optional OS association) and the user's switch for that association. The value only pre-fills the
 * add dialog of the Downloads module; nothing starts from it.
 */
export interface LaunchService {
  /** True where the OS association exists (Windows desktop); the pending value works on all desktops. */
  supported: boolean;
  /** Takes the pending magnet link / file path once (null when there is none). */
  takePending(): Promise<string | null>;
  /** Called when a second start hands something over to the running app; returns the unsubscribe. */
  onOpen(callback: () => void): Promise<() => void>;
  isRegistered(): Promise<boolean>;
  /** Registers (or removes) Nemo as a possible handler; Windows still asks the user to pick it. */
  setRegistered(enabled: boolean): Promise<void>;
}
