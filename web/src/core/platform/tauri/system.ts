import { invoke } from '@tauri-apps/api/core';
import type { DiskIo, ProcInfo, SystemInfo, SystemService } from '../system';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/system.rs`. */
export function createSystem(supported: boolean): SystemService {
  if (!supported)
    return {
      supported: false,
      info: unsupported,
      processes: unsupported,
      diskIo: unsupported,
      openTaskManager: unsupported,
    };
  return {
    supported: true,
    info: () => invoke<SystemInfo>('system_info'),
    processes: () => invoke<ProcInfo[]>('system_processes'),
    diskIo: () => invoke<DiskIo[]>('system_disk_io'),
    openTaskManager: () => invoke<void>('system_open_task_manager'),
  };
}
