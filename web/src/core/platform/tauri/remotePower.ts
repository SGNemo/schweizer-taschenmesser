import { invoke } from '@tauri-apps/api/core';

/** What the PC's countdown window shows (`src-tauri/src/remote_power.rs`); texts come from Rust. */
export interface PowerCountdown {
  /** "Svens Handy schaltet diesen PC in 7 Sekunden aus." – in the app's language. */
  text: string;
  note: string;
  cancel: string;
  /** The document's language (`de` or `en`). */
  lang: string;
}

/**
 * The countdown window's two calls (capability `power.json`): read the countdown, stop it. There
 * is no call that starts one – that only comes from the phone, through the LAN hub.
 */
export const remotePower = {
  status: () => invoke<PowerCountdown | null>('remote_power_status'),
  cancel: () => invoke<void>('remote_power_cancel'),
};
