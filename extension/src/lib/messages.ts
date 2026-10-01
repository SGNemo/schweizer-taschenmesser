/**
 * Messages between the content scripts / popup and the service worker. Strict: unknown fields are
 * rejected. The page origin is never part of a message – the service worker takes it from the
 * browser-provided sender – and the stored password never travels back to a page script.
 */
import { z } from 'zod';

const entryId = z.string().min(1).max(64);
const short = (max: number) => z.string().max(max);
const password = z.string().min(1).max(1024);

const genSettings = z.strictObject({
  mode: z.enum(['password', 'passphrase']),
  password: z.strictObject({
    length: z.number().int().min(1).max(1000),
    lower: z.boolean(),
    upper: z.boolean(),
    digits: z.boolean(),
    symbols: z.boolean(),
    avoidAmbiguous: z.boolean(),
  }),
  passphrase: z.strictObject({
    words: z.number().int().min(1).max(100),
    separator: short(8),
    capitalize: z.boolean(),
    includeNumber: z.boolean(),
  }),
});

export const requestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('status') }),
  z.strictObject({ type: z.literal('match') }),
  z.strictObject({
    type: z.literal('secret'),
    entryId,
    field: z.enum(['password', 'totp']),
  }),
  z.strictObject({ type: z.literal('generate'), settings: genSettings.optional() }),
  z.strictObject({
    type: z.literal('create'),
    title: z.string().min(1).max(200),
    username: short(500),
    password,
  }),
  z.strictObject({
    type: z.literal('pending-set'),
    title: short(200),
    username: short(500),
    password,
  }),
  z.strictObject({ type: z.literal('pending-get') }),
  z.strictObject({
    type: z.literal('pending-save'),
    title: short(200).optional(),
    username: short(500).optional(),
  }),
  z.strictObject({ type: z.literal('pending-clear') }),
  z.strictObject({ type: z.literal('submitted'), username: short(500), password }),
  // From the popup (no tab sender; the service worker looks at the active tab itself).
  z.strictObject({ type: z.literal('popup-state') }),
  z.strictObject({ type: z.literal('popup-fill'), entryId }),
  z.strictObject({
    type: z.literal('popup-copy'),
    entryId,
    field: z.enum(['username', 'password', 'totp']),
  }),
  z.strictObject({ type: z.literal('popup-copy-text'), text: z.string().min(1).max(1024) }),
]);
export type Request = z.infer<typeof requestSchema>;
export type GenSettingsMessage = z.infer<typeof genSettings>;

export type Failure =
  | 'locked'
  | 'app-missing'
  | 'not-paired'
  | 'origin-mismatch'
  | 'unknown-entry'
  | 'bad-request'
  | 'no-tab'
  | 'failed';
export type Reply<T = unknown> = { ok: true; data: T } | { ok: false; error: Failure };

/** Service worker → content script. */
export const contentCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('do-fill'),
    username: short(500),
    password: short(1024),
  }),
]);
export type ContentCommand = z.infer<typeof contentCommandSchema>;

/** Service worker → offscreen document. */
export const offscreenCommandSchema = z.strictObject({
  target: z.literal('offscreen'),
  cmd: z.literal('copy'),
  text: z.string().min(1).max(1024),
});
export type OffscreenCommand = z.infer<typeof offscreenCommandSchema>;
