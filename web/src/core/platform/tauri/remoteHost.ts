import { invoke } from '@tauri-apps/api/core';
import { noRemoteHost } from '../noRemoteHost';
import type { RemoteHostService, RemoteHostStatus } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/**
 * The PC's own remote-control settings (`src-tauri/src/remote.rs`). Nothing here sends input: the
 * four commands only read the state, narrow it, or ask the PC to widen it – and Windows asks the
 * person in a native dialog first, which this page cannot answer.
 */
export function createRemoteHost(supported: boolean): RemoteHostService {
  if (!supported) return noRemoteHost;
  return {
    supported,
    status: () => call<RemoteHostStatus>('remote_status'),
    setEnabled: (enabled) => call<void>('remote_set_enabled', { enabled }),
    setDevice: (id, grant) => call<void>('remote_set_device', { id, ...grant }),
    end: () => call<boolean>('remote_end'),
  };
}
