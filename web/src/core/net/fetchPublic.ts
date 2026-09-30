/**
 * Fetches a *public* URL (calendar or news feed). The native app asks the host directly (no CORS);
 * the browser cannot, so it goes through the sync server's `/v1/proxy` – without a sync server there
 * is no way and `PublicFetchError('no-proxy')` says so.
 */
import { getPlatform } from '@/core/platform';
import { loadSyncConfig } from '@/core/sync/service';

export class PublicFetchError extends Error {
  constructor(
    readonly code: 'no-proxy' | 'network',
    message: string = code,
  ) {
    super(message);
    this.name = 'PublicFetchError';
  }
}

export async function fetchPublic(url: string, init?: RequestInit): Promise<Response> {
  const platform = getPlatform();
  try {
    if (platform.isNative) return await platform.fetch(url, init);
  } catch (e) {
    throw new PublicFetchError('network', e instanceof Error ? e.message : String(e));
  }
  const config = await loadSyncConfig();
  if (!config) throw new PublicFetchError('no-proxy');
  const proxied = `${config.url.replace(/\/+$/, '')}/v1/proxy?url=${encodeURIComponent(url)}`;
  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${config.token}`);
  try {
    return await fetch(proxied, { ...init, headers });
  } catch (e) {
    throw new PublicFetchError('network', e instanceof Error ? e.message : String(e));
  }
}
