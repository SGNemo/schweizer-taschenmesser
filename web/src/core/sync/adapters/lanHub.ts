import { z } from 'zod';
import {
  SyncError,
  type FieldOp,
  type PullPage,
  type SyncAdapter,
  type SyncErrorCode,
} from '../types';
import { pullPageSchema } from './selfHosted';

/**
 * The home-network hub's JSON (`src-tauri/crates/lan-sync/src/hub/handler.rs`): one shape for the
 * hub PC's own client (in process) and for devices (inside Noise frames). The hub is a dumb store
 * like the Node server; merging stays in `mergeOps`. Every request carries the key version: after
 * "Schlüssel erneuern" an old-key request is refused instead of landing in the emptied store.
 */
interface HubTransport {
  request(body: string): Promise<string>;
}

interface Options {
  /** Largest JSON request body (a device's request travels in one Noise frame of ≤ 64 KiB). */
  maxRequestBytes: number;
  /** Largest pull page asked for; halved after `response-too-large` (one frame per answer, too). */
  pullLimit: number;
  /** What `stale-key-version` means here (the hub PC fetches the new key; a device must pair again). */
  staleKey: SyncErrorCode;
  /** The transport's own failures (thrown with a short code). */
  transportError(code: string): SyncErrorCode;
}

const pushSchema = z.object({ epoch: z.string().min(1).max(64) });

export class HubJsonAdapter implements SyncAdapter {
  /** Page size that last fitted one frame: kept between calls, grows back gently. */
  private pullAsk: number;

  constructor(
    readonly kind: string,
    private readonly transport: HubTransport,
    private readonly keyVersion: number,
    private readonly opts: Options,
  ) {
    this.pullAsk = opts.pullLimit;
  }

  private async send(body: Record<string, unknown>): Promise<unknown> {
    let text: string;
    try {
      text = await this.transport.request(JSON.stringify({ keyVersion: this.keyVersion, ...body }));
    } catch (e) {
      throw new SyncError(this.opts.transportError(e instanceof Error ? e.message : ''));
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SyncError('server', 'malformed response');
    }
    const error = (parsed as { error?: unknown } | null)?.error;
    if (typeof error === 'string') throw new SyncError(this.errorCode(error), error);
    return parsed;
  }

  private errorCode(code: string): SyncErrorCode {
    if (code === 'hlc-drift') return 'clock';
    if (code === 'stale-key-version') return this.opts.staleKey;
    return 'server';
  }

  /** Pushes in slices whose JSON stays under the request budget (the hub accepts each slice alone). */
  async push(ops: FieldOp[]): Promise<{ epoch: string }> {
    let epoch = '';
    for (const slice of slices(ops, this.opts.maxRequestBytes)) {
      const parsed = pushSchema.safeParse(await this.send({ type: 'push', ops: slice }));
      if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
      epoch = parsed.data.epoch;
    }
    if (!epoch) {
      // nothing to push: ask for the epoch alone
      const parsed = pushSchema.safeParse(await this.send({ type: 'info' }));
      if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
      epoch = parsed.data.epoch;
    }
    return { epoch };
  }

  async pull(since: number, limit: number): Promise<PullPage> {
    for (;;) {
      const ask = Math.max(1, Math.min(limit, this.pullAsk));
      try {
        const parsed = pullPageSchema.safeParse(
          await this.send({ type: 'pull', since, limit: ask }),
        );
        if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
        // it fitted: allow a little more next time, never more than the configured page
        this.pullAsk = Math.min(this.opts.pullLimit, Math.max(ask, this.pullAsk) + 25);
        return parsed.data;
      } catch (e) {
        // the page would not fit one frame: smaller pages (one op always fits, see hub MAX_VALUE_BYTES)
        if (e instanceof SyncError && e.message === 'response-too-large' && ask > 1) {
          this.pullAsk = Math.max(1, Math.floor(ask / 2));
          continue;
        }
        throw e;
      }
    }
  }
}

/** Splits ops so each slice's JSON stays under `budget` bytes (an op alone always goes on its own). */
export function slices(ops: FieldOp[], budget: number): FieldOp[][] {
  const out: FieldOp[][] = [];
  const encoder = new TextEncoder();
  let current: FieldOp[] = [];
  let size = 64; // envelope: {"keyVersion":…,"type":"push","ops":[]}
  for (const op of ops) {
    const bytes = encoder.encode(JSON.stringify(op)).length + 1;
    if (current.length > 0 && size + bytes > budget) {
      out.push(current);
      current = [];
      size = 64;
    }
    current.push(op);
    size += bytes;
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** The hub PC's own client: in process, not framed. */
export class LanHubAdapter extends HubJsonAdapter {
  constructor(hub: HubTransport, keyVersion: number) {
    super('lanHub', hub, keyVersion, {
      maxRequestBytes: 3_000_000,
      pullLimit: 1000,
      // the key was renewed meanwhile: the next round (retried like a server hiccup) takes the new one
      staleKey: 'server',
      // hub not started or stopped meanwhile: the same calm "not reachable" as an offline server
      transportError: () => 'network',
    });
  }
}

/** Largest request JSON a device sends: one Noise frame is ≤ 65 535 B including tag and MAC. */
export const DEVICE_REQUEST_BYTES = 60_000;

/** A device (phone) talking to the hub PC over the home network. */
export class LanClientAdapter extends HubJsonAdapter {
  constructor(client: HubTransport, keyVersion: number) {
    super('lanClient', client, keyVersion, {
      maxRequestBytes: DEVICE_REQUEST_BYTES,
      pullLimit: 200,
      // the PC renewed its key: this device has to pair again ("Daten vom PC lassen sich nicht lesen")
      staleKey: 'decrypt',
      // only the hub's authenticated refusal (or no pairing at all) means "unpaired"; anything else
      // – no answer, a wrong key on that address, a reset – is the calm "not reachable"
      transportError: (code) =>
        code === 'unknown-device' || code === 'not-paired'
          ? 'revoked'
          : code === 'protocol'
            ? 'server'
            : 'network',
    });
  }
}
