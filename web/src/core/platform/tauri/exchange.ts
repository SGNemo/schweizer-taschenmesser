import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { noExchange } from '../noExchange';
import type {
  ExchangeAnswer,
  ExchangeEvent,
  ExchangeItem,
  ExchangePcStatus,
  ExchangeService,
} from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

type Wire =
  | { type: 'received'; session: number }
  | { type: 'answer'; session: number; id: string; state: ExchangeAnswer['state'] }
  | { type: 'closed'; session: number; reason: string | null; minutes: number | null };

/**
 * Device exchange in the native shell (`src-tauri/src/exchange.rs` on the PC,
 * `exchange_client.rs` on the phone). Widening a grant at the PC is asked by Windows in a native
 * dialog this page cannot answer.
 */
export function createExchange(side: 'pc' | 'phone' | null): ExchangeService {
  if (side === 'pc') {
    return {
      ...noExchange,
      side,
      status: () => call<ExchangePcStatus>('exchange_status'),
      send: (peer, item) => call<void>('exchange_send', { peer, ...item }),
      take: () => call<{ items: ExchangeItem[]; answers: ExchangeAnswer[] }>('exchange_take'),
      confirm: (ids) => call<void>('exchange_confirm', { ids }),
      setEnabled: (enabled) => call<void>('exchange_set_enabled', { enabled }),
      setDevice: (id, on, paused) => call<void>('exchange_set_device', { id, on, paused }),
      onChanged: (cb) => {
        let off: (() => void) | null = null;
        let gone = false;
        void listen('exchange://changed', () => cb()).then((un) => {
          if (gone) un();
          else off = un;
        });
        return () => {
          gone = true;
          off?.();
        };
      },
    };
  }
  if (side === 'phone') {
    return {
      ...noExchange,
      side,
      take: async () => ({
        items: await call<ExchangeItem[]>('exchange_client_take'),
        answers: [],
      }),
      confirm: (ids) => call<void>('exchange_client_confirm', { ids }),
      open: async (onEvent: (e: ExchangeEvent) => void) => {
        let mine = 0;
        const channel = new Channel<Wire>();
        channel.onmessage = (w) => {
          // events of an older session are not this one's
          if (mine !== 0 && w.session !== mine) return;
          if (w.type === 'received') onEvent({ type: 'received' });
          else if (w.type === 'answer') onEvent({ type: 'answer', id: w.id, state: w.state });
          else onEvent({ type: 'closed', reason: w.reason, minutes: w.minutes });
        };
        mine = await call<number>('exchange_client_open', { onEvent: channel });
        return {
          send: (item) => call<void>('exchange_client_send', { session: mine, ...item }),
          ping: () => call<void>('exchange_client_ping', { session: mine }),
          close: () => call<void>('exchange_client_close', { session: mine }),
        };
      },
    };
  }
  return noExchange;
}
