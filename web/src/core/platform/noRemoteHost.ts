import type { RemoteHostService } from './types';

/** Where this device cannot be the controlled PC (browser, phone): nothing to read or change. */
export const noRemoteHost: RemoteHostService = {
  supported: false,
  status: () => Promise.reject(new Error('unsupported')),
  setEnabled: () => Promise.reject(new Error('unsupported')),
  setDevice: () => Promise.reject(new Error('unsupported')),
  setNotice: () => Promise.reject(new Error('unsupported')),
  end: async () => false,
};
