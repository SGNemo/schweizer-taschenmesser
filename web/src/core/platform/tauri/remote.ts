import { Channel, invoke } from '@tauri-apps/api/core';
import { noRemote } from '../noRemote';
import type { RemoteEvent, RemoteOpened, RemoteService } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/** Farthest way of one call the shell is handed (it shortens to one frame itself). */
const FAR = 100_000;
/** The shell takes whole numbers; a fraction is the caller's to carry over, nonsense is no way. */
const whole = (n: number): number =>
  Number.isFinite(n) ? Math.max(-FAR, Math.min(FAR, Math.trunc(n))) : 0;

/**
 * The phone's input session with the paired PC (`src-tauri/src/remote_client.rs`). The device key
 * and the pinned PC stay in Rust; this bridge passes on a level, action names from a fixed list
 * and what the PC answers.
 */
export function createRemote(supported: boolean): RemoteService {
  if (!supported) return noRemote;
  return {
    supported,
    open(level, onEvent, lang) {
      const channel = new Channel<RemoteEvent>();
      channel.onmessage = (event) => onEvent(event);
      return call<RemoteOpened>('remote_client_open', {
        level,
        lang: lang ?? null,
        onEvent: channel,
      });
    },
    send: (session, actions) => call<void>('remote_client_send', { session, actions }),
    pointer: (session, kind, dx, dy) =>
      call<void>('remote_client_pointer', {
        session,
        kind,
        dx: whole(dx),
        dy: whole(dy),
      }),
    close: (session) => call<void>('remote_client_close', { session }),
  };
}
