import { invoke } from '@tauri-apps/api/core';
import type { ProcInfo, SystemInfo, SystemService } from '../system';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/system.rs`. */
export function createSystem(supported: boolean): SystemService {
  if (!supported) return { supported: false, info: unsupported, processes: unsupported };
  return {
    supported: true,
    info: () => invoke<SystemInfo>('system_info'),
    processes: () => invoke<ProcInfo[]>('system_processes'),
  };
}
