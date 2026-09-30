import { Channel, invoke } from '@tauri-apps/api/core';
import type { LocalApiRequest, LocalApiService } from '../types';

/** The desktop shell's loopback server; requests arrive on a channel, answers go back by id. */
export function createLocalApi(supported: boolean): LocalApiService {
  const unsupported = () => Promise.reject(new Error('unsupported'));
  if (!supported) {
    return { supported, start: unsupported, setTokens: unsupported, stop: async () => {} };
  }
  return {
    supported,
    async start(port, tokens, onRequest) {
      const channel = new Channel<LocalApiRequest>();
      channel.onmessage = (req) => {
        void (async () => {
          let reply: { status: number; body: string };
          try {
            reply = await onRequest(req);
          } catch {
            reply = { status: 500, body: '{"error":"internal"}' };
          }
          await invoke('local_api_respond', { id: req.id, ...reply }).catch(() => undefined);
        })();
      };
      return invoke<number>('local_api_start', { port, tokens, onRequest: channel });
    },
    setTokens: (tokens) => invoke('local_api_set_tokens', { tokens }),
    stop: () => invoke('local_api_stop'),
  };
}
