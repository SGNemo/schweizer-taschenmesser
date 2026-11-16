import type { ExchangeService } from './types';

const unsupported = () => Promise.reject(new Error('unsupported'));

/** Where there is no home-network channel (the browser): nothing to send or receive. */
export const noExchange: ExchangeService = {
  side: null,
  status: unsupported,
  send: unsupported,
  take: async () => ({ items: [], answers: [] }),
  confirm: async () => undefined,
  setEnabled: unsupported,
  setDevice: unsupported,
  onChanged: () => () => undefined,
  open: unsupported,
};
