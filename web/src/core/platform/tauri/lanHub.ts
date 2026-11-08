import { invoke } from '@tauri-apps/api/core';
import type { LanHubDataKey, LanHubDevice, LanHubService, LanHubStatus } from '../types';

const OFF: LanHubStatus = {
  running: false,
  state: 'off',
  blocked: false,
  pairingOpen: false,
  devices: 0,
};

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/** The desktop shell's home-network sync hub (`src-tauri/src/lan_sync.rs`). */
export function createLanHub(supported: boolean): LanHubService {
  const unsupported = () => Promise.reject(new Error('unsupported'));
  if (!supported) {
    return {
      supported,
      start: unsupported,
      stop: async () => undefined,
      status: async () => OFF,
      pairOpen: unsupported,
      pairConfirm: unsupported,
      pairCancel: async () => undefined,
      devices: async () => [],
      revoke: unsupported,
      rotate: unsupported,
      request: unsupported,
      setHome: unsupported,
    };
  }
  return {
    supported,
    start: () => call<{ status: LanHubStatus; dataKey: LanHubDataKey }>('lan_hub_start'),
    stop: () => call<void>('lan_hub_stop'),
    status: () => call<LanHubStatus>('lan_hub_status'),
    pairOpen: () => call<void>('lan_pair_open'),
    pairConfirm: (attempt, code) => call<void>('lan_pair_confirm', { attempt, code }),
    pairCancel: () => call<void>('lan_pair_cancel'),
    devices: () => call<LanHubDevice[]>('lan_devices'),
    revoke: (id) => call<boolean>('lan_revoke', { id }),
    rotate: () => call<LanHubDataKey>('lan_hub_rotate'),
    request: (body) => call<string>('lan_hub_request', { body }),
    setHome: () => call<void>('lan_home_set'),
  };
}
