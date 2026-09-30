/**
 * Runs the local AI import API while it is switched on: (re)starts the native server when the
 * setting or port changes, pushes token changes (new, revoked) to it right away, and answers
 * requests with `handleRequest`. Desktop only; elsewhere the status says "unsupported".
 */
import { liveQuery } from 'dexie';
import { create } from 'zustand';
import { visibleManifests } from '@/core/modules/registry';
import { getPlatform } from '@/core/platform';
import type { LocalApiRequest } from '@/core/platform/types';
import { loadConfig, serverTokens, type LocalApiConfig } from './config';
import { handleRequest } from './handler';
import { appendLog } from './log';

export interface LocalApiStatus {
  state: 'unsupported' | 'off' | 'starting' | 'running' | 'error';
  port?: number;
  /** `port-in-use`, `port-denied`, `listen-failed`. */
  error?: string;
}

export const useLocalApiStatus = create<LocalApiStatus>(() => ({ state: 'off' }));

async function onRequest(req: LocalApiRequest): Promise<{ status: number; body: string }> {
  const result = await handleRequest(req, { manifests: visibleManifests });
  await appendLog(result.log).catch(() => undefined);
  return { status: result.status, body: JSON.stringify(result.body) };
}

export function startLocalApi(): () => void {
  const api = getPlatform().localApi;
  if (!api.supported) {
    useLocalApiStatus.setState({ state: 'unsupported' });
    return () => {};
  }
  let runningPort: number | null = null;
  let chain = Promise.resolve();

  const apply = async (config: LocalApiConfig) => {
    if (!config.enabled) {
      if (runningPort !== null) await api.stop().catch(() => undefined);
      runningPort = null;
      useLocalApiStatus.setState({ state: 'off' }, true);
      return;
    }
    if (runningPort === config.port) {
      await api.setTokens(serverTokens(config)).catch(() => undefined);
      return;
    }
    useLocalApiStatus.setState({ state: 'starting', port: config.port }, true);
    try {
      runningPort = await api.start(config.port, serverTokens(config), onRequest);
      useLocalApiStatus.setState({ state: 'running', port: runningPort }, true);
    } catch (e) {
      runningPort = null;
      const code = e instanceof Error ? e.message : String(e);
      useLocalApiStatus.setState(
        {
          state: 'error',
          port: config.port,
          error: ['port-in-use', 'port-denied'].includes(code) ? code : 'listen-failed',
        },
        true,
      );
    }
  };

  const sub = liveQuery(() => loadConfig()).subscribe({
    next: (config) => {
      chain = chain.then(() => apply(config));
    },
  });
  return () => {
    sub.unsubscribe();
    chain = chain.then(() => api.stop().catch(() => undefined));
  };
}
