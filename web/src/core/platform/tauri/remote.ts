import { Channel, invoke } from '@tauri-apps/api/core';
import { noRemote } from '../noRemote';
import type { RemoteEvent, RemoteOpened, RemoteService } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/**
 * The phone's input session with the paired PC (`src-tauri/src/remote_client.rs`). The device key
 * and the pinned PC stay in Rust; this bridge passes on a level, action names from a fixed list
 * and what the PC answers.
 */
export function createRemote(supported: boolean): RemoteService {
  if (!supported) return noRemote;
  return {
    supported,
    open(level, onEvent) {
      const channel = new Channel<RemoteEvent>();
      channel.onmessage = (event) => onEvent(event);
      return call<RemoteOpened>('remote_client_open', { level, onEvent: channel });
    },
    send: (session, actions) => call<void>('remote_client_send', { session, actions }),
    close: (session) => call<void>('remote_client_close', { session }),
  };
}
