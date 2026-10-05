import { vi, type Mock } from 'vitest';
import { toHex } from '../../../packages/supporter-codes/src/index.ts';
import {
  TEST_KEY_ID,
  TEST_PUBLIC_KEY,
  TEST_SECRET_KEY,
} from '../../../packages/supporter-codes/test/fixtures/test-keypair.ts';
import type { BatchLike, MessageLike } from '../src/queue.ts';
import type { Deps, Env, MailJob } from '../src/types.ts';

export const PUBLIC_KEYS = { [TEST_KEY_ID]: TEST_PUBLIC_KEY };
export const TOKEN = 'test-token-not-a-secret-0123456789';
export const OWNER = 'owner@example.invalid';

/** In-memory KV: records every write so tests can see what was (not) stored. */
export class MemoryKv {
  data = new Map<string, string>();
  writes: string[] = [];
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.writes.push(key);
    this.data.set(key, value);
  }
  dump(): string {
    return JSON.stringify([...this.data.entries()]);
  }
}

export function makeEnv(over: Partial<Env> = {}) {
  const kv = new MemoryKv();
  const jobs: MailJob[] = [];
  const env: Env = {
    KV: kv,
    MAIL_QUEUE: {
      send: async (m) => {
        jobs.push(m);
      },
    },
    KOFI_VERIFICATION_TOKEN: TOKEN,
    // Throw-away key of the public test pair (the app never accepts it).
    SUPPORTER_SIGNING_KEY: toHex(TEST_SECRET_KEY),
    RESEND_API_KEY: 're_test_not_a_key',
    HASH_PEPPER: 'test-pepper-not-a-secret',
    OWNER_EMAIL: OWNER,
    SIGNING_KEY_ID: String(TEST_KEY_ID),
    MAIL_FROM: 'Nemo <nemo@example.invalid>',
    ...over,
  };
  return { env, kv, jobs };
}

export interface FetchCall {
  url: string;
  to: string[];
  subject: string;
  text: string;
}

/** Fake Resend: answers with the given statuses in turn (the last one repeats). */
export function makeDeps(statuses: number[] = [200]) {
  const calls: FetchCall[] = [];
  let i = 0;
  const deps: Deps = {
    now: () => new Date('2026-10-05T10:00:00Z'),
    fetch: vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { to: string[]; subject: string; text: string };
      calls.push({ url, to: body.to, subject: body.subject, text: body.text });
      const status = statuses[Math.min(i++, statuses.length - 1)]!;
      return new Response('{}', { status });
    }),
  };
  return { deps, calls };
}

/** Invented Ko-fi donation payload (all values made up). */
export const donation = (over: Record<string, unknown> = {}) => ({
  verification_token: TOKEN,
  message_id: '00000000-0000-4000-8000-000000000001',
  timestamp: '2026-10-05T09:00:00Z',
  type: 'Donation',
  is_public: true,
  from_name: 'Ada Beispiel',
  message: 'Nice app',
  amount: '5.00',
  url: 'https://ko-fi.com/Home/CoffeeShop?txid=00000000-0000-4000-8000-000000000001',
  email: 'ada.donor@example.invalid',
  currency: 'EUR',
  is_subscription_payment: false,
  is_first_subscription_payment: false,
  kofi_transaction_id: '11111111-2222-4333-8444-555555555555',
  shop_items: null,
  tier_name: null,
  shipping: null,
  ...over,
});

export const kofiRequest = (payload: unknown, init: { path?: string; method?: string } = {}) =>
  new Request(`https://hook.example.invalid${init.path ?? '/kofi'}`, {
    method: init.method ?? 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: JSON.stringify(payload) }).toString(),
  });

type RetryOptions = { delaySeconds?: number };
export type TestMessage = MessageLike & {
  ack: Mock<() => void>;
  retry: Mock<(options?: RetryOptions) => void>;
};

export function makeMessage(job: MailJob, attempts = 1): TestMessage {
  return {
    body: job,
    attempts,
    ack: vi.fn<() => void>(),
    retry: vi.fn<(options?: RetryOptions) => void>(),
  };
}

export const batchOf = (queue: string, ...messages: MessageLike[]): BatchLike => ({
  queue,
  messages,
});
