import { invoke } from '@tauri-apps/api/core';
import { noRemoteHost } from '../noRemoteHost';
import type { RemoteHostPrograms, RemoteHostService, RemoteHostStatus } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/**
 * The PC's own remote-control settings (`src-tauri/src/remote.rs`). Nothing here sends input: the
 * commands only read the state, narrow it, report what Nemo is busy with, or ask the PC to widen it – and Windows asks the
 * person in a native dialog first, which this page cannot answer.
 */
export function createRemoteHost(supported: boolean): RemoteHostService {
  if (!supported) return noRemoteHost;
  return {
    supported,
    status: () => call<RemoteHostStatus>('remote_status'),
    setEnabled: (enabled) => call<void>('remote_set_enabled', { enabled }),
    setDevice: (id, grant) => call<void>('remote_set_device', { id, ...grant }),
    setNotice: (on) => call<void>('remote_set_notice', { on }),
    end: () => call<boolean>('remote_end'),
    programs: () => call<RemoteHostPrograms>('remote_programs'),
    // no path: the PC shows its own file dialog and asks before anything is added
    addProgram: () => call<void>('remote_program_add'),
    removeProgram: (slot, version) => call<void>('remote_program_remove', { slot, version }),
    reportBusy: (bits) => call<void>('remote_set_busy', { bits }),
  };
}
