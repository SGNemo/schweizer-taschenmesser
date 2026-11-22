import { invoke } from '@tauri-apps/api/core';
import { noDeviceWipe, type DeviceWipeReport, type DeviceWipeService } from '../deviceWipe';

/** Bridge to `device_wipe` (desktop and Android; the command takes no path). */
export function createDeviceWipe(supported: boolean): DeviceWipeService {
  if (!supported) return noDeviceWipe;
  return {
    supported: true,
    wipe: ({ models }) => invoke<DeviceWipeReport>('device_wipe', { models }),
  };
}
