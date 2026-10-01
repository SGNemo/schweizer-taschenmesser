/**
 * Messages between the browser extension and the desktop app (native messaging → host → pipe → app).
 * Every schema is strict: unknown fields are rejected, sizes are capped. Replies and errors carry
 * codes only – never an origin, a URL, a user name or any secret.
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
/** Native messaging host name (also the registry sub-key). */
export const HOST_NAME = 'io.github.sgnemo.taschenmesser.vault';
/**
 * Extension ID derived from the public `key` in `extension/manifest.json`. The allowlist of the host
 * manifest and of the app both contain exactly this ID.
 */
export const EXTENSION_ID = 'olgcnfjmihlmpgjepkfbdjcpenckemaj';
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}/`;
/** Browsers cap host → browser messages at 1 MB; we stay far below. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

const id = z.string().min(1).max(64);
const origin = z.string().min(1).max(2048);
const text = (max: number) => z.string().max(max);

const base = {
  v: z.literal(PROTOCOL_VERSION),
  /** Unique per request; a reused id is a replay. */
  id: z.uuid(),
  /** From the `hello` reply; required for everything but `hello` and `status`. */
  session: z.string().min(16).max(64).optional(),
  /** Strictly increasing per session, starting at 1. */
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
  /** Written by the native host from the browser's argument – a message cannot choose its own. */
  origin: z.string().min(1).max(256),
};

const empty = z.strictObject({});

export const requestSchema = z.discriminatedUnion('op', [
  z.strictObject({ ...base, op: z.literal('hello'), body: empty }),
  z.strictObject({ ...base, op: z.literal('status'), body: empty }),
  z.strictObject({ ...base, op: z.literal('genParams'), body: empty }),
  z.strictObject({
    ...base,
    op: z.literal('match'),
    body: z.strictObject({ pageOrigin: origin }),
  }),
  z.strictObject({
    ...base,
    op: z.literal('secret'),
    body: z.strictObject({
      entryId: id,
      pageOrigin: origin,
      field: z.enum(['password', 'totp']),
    }),
  }),
  z.strictObject({
    ...base,
    op: z.literal('create'),
    body: z.strictObject({
      title: z.string().min(1).max(200),
      username: text(500),
      password: z.string().min(1).max(1024),
      url: text(2048),
      pageOrigin: origin,
    }),
  }),
  z.strictObject({
    ...base,
    op: z.literal('compare'),
    body: z.strictObject({
      entryId: id,
      password: z.string().min(1).max(1024),
      pageOrigin: origin,
    }),
  }),
  z.strictObject({
    ...base,
    op: z.literal('update'),
    body: z.strictObject({
      entryId: id,
      password: z.string().min(1).max(1024),
      pageOrigin: origin,
    }),
  }),
]);
export type BridgeRequest = z.infer<typeof requestSchema>;
export type BridgeOp = BridgeRequest['op'];

export const ERROR_CODES = [
  'locked',
  'not-paired',
  'bad-request',
  'origin-mismatch',
  'replay',
  'no-session',
  'unknown-entry',
  'rate-limited',
  'app-not-running', // set by the native host, never by the app
  'internal',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type BridgeErrorCode = z.infer<typeof errorCodeSchema>;

export const helloReplySchema = z.strictObject({
  state: z.enum(['locked', 'unlocked', 'pairing', 'rejected']),
  session: z.string().optional(),
  /** Six digits, shown in the app and in the extension while pairing. */
  pairCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export const statusReplySchema = z.strictObject({ state: z.enum(['locked', 'unlocked']) });
export const matchReplySchema = z.strictObject({
  entries: z.array(
    z.strictObject({
      id,
      title: z.string(),
      username: z.string(),
      url: z.string(),
      hasTotp: z.boolean(),
    }),
  ),
});
export const secretReplySchema = z.strictObject({ value: z.string() });
export const createReplySchema = z.strictObject({ id });
export const compareReplySchema = z.strictObject({ same: z.boolean() });
export const updateReplySchema = z.strictObject({ ok: z.literal(true) });
export const genParamsReplySchema = z.strictObject({
  length: z.number().int().min(8).max(128),
  lower: z.boolean(),
  upper: z.boolean(),
  digits: z.boolean(),
  symbols: z.boolean(),
  avoidAmbiguous: z.boolean(),
});

export const replySchema = z.union([
  z.strictObject({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string(),
    ok: z.literal(true),
    data: z.unknown(),
  }),
  z.strictObject({
    v: z.literal(PROTOCOL_VERSION),
    id: z.string(),
    ok: z.literal(false),
    error: errorCodeSchema,
  }),
]);
export type BridgeReply = z.infer<typeof replySchema>;

/** Pushed by the app (through the host) to every connected extension. */
export const eventSchema = z.strictObject({
  v: z.literal(PROTOCOL_VERSION),
  event: z.enum(['locked']),
});

export const okReply = (requestId: string, data: unknown): BridgeReply => ({
  v: PROTOCOL_VERSION,
  id: requestId,
  ok: true,
  data,
});
export const errorReply = (requestId: string, error: BridgeErrorCode): BridgeReply => ({
  v: PROTOCOL_VERSION,
  id: requestId,
  ok: false,
  error,
});

/** `chrome-extension://<id>/` → `<id>`; anything else → undefined. */
export function extensionIdOf(originArg: string): string | undefined {
  const m = /^chrome-extension:\/\/([a-p]{32})\/?$/.exec(originArg);
  return m?.[1];
}
