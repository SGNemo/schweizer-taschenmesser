import type { RemoteService } from './types';

/** Where this device cannot be a remote control (browser, desktop app): nothing to open. */
export const noRemote: RemoteService = {
  supported: false,
  open: () => Promise.reject(new Error('unsupported')),
  send: () => Promise.reject(new Error('unsupported')),
  close: async () => undefined,
};
