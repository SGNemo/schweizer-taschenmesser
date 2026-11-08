import { z } from 'zod';
import type { LanHubService } from '@/core/platform/types';
import { SyncError, type FieldOp, type PullPage, type SyncAdapter } from '../types';
import { pullPageSchema } from './selfHosted';

/**
 * The hub PC's own client: talks to the home-network hub inside this app (`lan_hub_request`, in
 * process, same JSON as remote clients – `src-tauri/crates/lan-sync/src/hub/handler.rs`). The hub
 * is a dumb store like the Node server; merging stays in `mergeOps`. Every request carries the key
 * version: after "Schlüssel erneuern" an old-key request is refused instead of landing in the
 * emptied store.
 */
export class LanHubAdapter implements SyncAdapter {
  readonly kind = 'lanHub';

  constructor(
    private readonly hub: Pick<LanHubService, 'request'>,
    private readonly keyVersion: number,
  ) {}

  private async send(body: Record<string, unknown>): Promise<unknown> {
    let text: string;
    try {
      text = await this.hub.request(JSON.stringify({ keyVersion: this.keyVersion, ...body }));
    } catch {
      // Hub not started or stopped meanwhile: the same calm "not reachable" as an offline server.
      throw new SyncError('network');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SyncError('server', 'malformed response');
    }
    const error = (parsed as { error?: unknown } | null)?.error;
    if (typeof error === 'string') throw new SyncError(errorCode(error), error);
    return parsed;
  }

  async push(ops: FieldOp[]): Promise<{ epoch: string }> {
    const parsed = pushSchema.safeParse(await this.send({ type: 'push', ops }));
    if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
    return { epoch: parsed.data.epoch };
  }

  async pull(since: number, limit: number): Promise<PullPage> {
    const parsed = pullPageSchema.safeParse(await this.send({ type: 'pull', since, limit }));
    if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
    return parsed.data;
  }
}

const pushSchema = z.object({ epoch: z.string().min(1).max(64) });

/** Hub error codes (`HubError::code`) → the engine's codes. */
function errorCode(code: string): SyncError['code'] {
  if (code === 'hlc-drift') return 'clock';
  // `stale-key-version`: the key was renewed meanwhile; the next round (retried like a server hiccup)
  // starts with the hub's new key. Everything else is a hub-side problem, also retried.
  return 'server';
}
