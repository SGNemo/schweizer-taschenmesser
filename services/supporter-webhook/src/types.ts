import type { SupporterTier } from '../../../packages/supporter-codes/src/index.ts';

/** Just the parts of the Cloudflare bindings this service uses (keeps tests free of workerd). */
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface QueueLike<T> {
  send(message: T): Promise<void>;
}

export interface RateLimitLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** What travels through the mail queue. The address lives here only until the mail is sent. */
export interface MailJob {
  kind: 'code' | 'resend';
  txKey: string;
  to: string;
  code: string;
  tier: SupporterTier;
}

export interface Env {
  KV: KvLike;
  MAIL_QUEUE: QueueLike<MailJob>;
  /** Optional: without the binding there is simply no rate limit (local `wrangler dev`). */
  RATE_LIMITER?: RateLimitLike;
  // Secrets (`wrangler secret put`), never in the repo:
  KOFI_VERIFICATION_TOKEN: string;
  SUPPORTER_SIGNING_KEY: string;
  RESEND_API_KEY: string;
  HASH_PEPPER: string;
  OWNER_EMAIL: string;
  // Plain variables (wrangler.toml):
  SIGNING_KEY_ID: string;
  MAIL_FROM: string;
  /** Optional public address that receives replies to the donor mail (e.g. a Cloudflare Email Routing address). */
  REPLY_TO?: string;
}

export interface Deps {
  now(): Date;
  fetch(input: string, init: RequestInit): Promise<Response>;
}

export const defaultDeps: Deps = {
  now: () => new Date(),
  fetch: (input, init) => fetch(input, init),
};

/** KV record per donation: no address, only keyed hashes. */
export interface TxRecord {
  code: string;
  tier: SupporterTier;
  /** HMAC of the lower-cased donor address (for "resend" matching), never the address. */
  emailMac: string;
  mail: 'queued' | 'sent' | 'failed';
}

export const QUEUE_NAME = 'supporter-mail';
export const DLQ_NAME = 'supporter-mail-dlq';
export const MAX_ATTEMPTS = 5; // keep in step with wrangler.toml `max_retries`
export const RECORD_TTL_SECONDS = 400 * 24 * 60 * 60;
