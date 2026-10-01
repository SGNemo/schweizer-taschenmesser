import { describe, expect, it } from 'vitest';
import {
  EXTENSION_ID,
  EXTENSION_ORIGIN,
  MAX_MESSAGE_BYTES,
  errorReply,
  extensionIdOf,
  okReply,
  replySchema,
  requestSchema,
} from '../src/protocol';

const base = {
  v: 1,
  id: '4b1f6a3e-5c2d-4e8a-9f10-1a2b3c4d5e6f',
  origin: EXTENSION_ORIGIN,
};

describe('request schema', () => {
  it('accepts every op with its body', () => {
    const ok = [
      { ...base, op: 'hello', body: {} },
      { ...base, op: 'status', body: {} },
      { ...base, op: 'genParams', body: {}, session: 's'.repeat(22), seq: 1 },
      { ...base, op: 'match', body: { pageOrigin: 'https://example.com' } },
      {
        ...base,
        op: 'secret',
        body: { entryId: 'e1', pageOrigin: 'https://example.com', field: 'totp' },
      },
      {
        ...base,
        op: 'create',
        body: {
          title: 'Example',
          username: 'a@b.test',
          password: 'pw',
          url: 'https://example.com',
          pageOrigin: 'https://example.com',
        },
      },
      {
        ...base,
        op: 'compare',
        body: { entryId: 'e1', password: 'pw', pageOrigin: 'https://example.com' },
      },
      {
        ...base,
        op: 'update',
        body: { entryId: 'e1', password: 'pw', pageOrigin: 'https://example.com' },
      },
    ];
    for (const r of ok) expect(requestSchema.safeParse(r).success, r.op).toBe(true);
  });

  it('rejects unknown fields at every level', () => {
    expect(requestSchema.safeParse({ ...base, op: 'hello', body: {}, extra: 1 }).success).toBe(
      false,
    );
    expect(requestSchema.safeParse({ ...base, op: 'hello', body: { x: 1 } }).success).toBe(false);
    expect(
      requestSchema.safeParse({
        ...base,
        op: 'match',
        body: { pageOrigin: 'https://example.com', all: true },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown ops, wrong versions, bad ids and oversize fields', () => {
    expect(requestSchema.safeParse({ ...base, op: 'dump', body: {} }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, v: 2, op: 'hello', body: {} }).success).toBe(false);
    expect(
      requestSchema.safeParse({ ...base, id: 'not-a-uuid', op: 'hello', body: {} }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        ...base,
        op: 'create',
        body: {
          title: 't',
          username: '',
          password: 'x'.repeat(1025),
          url: '',
          pageOrigin: 'https://e.test',
        },
      }).success,
    ).toBe(false);
    expect(requestSchema.safeParse({ ...base, seq: 0, op: 'hello', body: {} }).success).toBe(false);
  });

  it('has no way to ask for the whole vault', () => {
    for (const op of ['list', 'dump', 'all', 'export']) {
      expect(requestSchema.safeParse({ ...base, op, body: {} }).success).toBe(false);
    }
  });
});

describe('replies', () => {
  it('builds ok and error replies that parse', () => {
    expect(replySchema.safeParse(okReply('1', { state: 'locked' })).success).toBe(true);
    expect(replySchema.safeParse(errorReply('1', 'locked')).success).toBe(true);
    expect(
      replySchema.safeParse({ v: 1, id: '1', ok: false, error: 'https://secret.test' }).success,
    ).toBe(false);
  });
});

describe('extension id', () => {
  it('is a valid 32-letter id and round-trips through the origin', () => {
    expect(EXTENSION_ID).toMatch(/^[a-p]{32}$/);
    expect(extensionIdOf(EXTENSION_ORIGIN)).toBe(EXTENSION_ID);
    expect(extensionIdOf(`chrome-extension://${EXTENSION_ID}`)).toBe(EXTENSION_ID);
  });
  it('rejects other origins', () => {
    for (const o of [
      'https://example.com',
      'chrome-extension://short/',
      'chrome-extension://' + 'z'.repeat(32) + '/',
      'moz-extension://abc/',
    ]) {
      expect(extensionIdOf(o)).toBeUndefined();
    }
  });
  it('caps messages well below the browser limit', () => {
    expect(MAX_MESSAGE_BYTES).toBeLessThan(1024 * 1024);
  });
});
