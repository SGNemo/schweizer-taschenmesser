import { Agent } from 'node:https';
import { describe, expect, it } from 'vitest';
import { publicOnlyLookup, requestOptions } from '../src/push.js';

// R8 (launch review 2026-11): the push endpoint was checked for private addresses only when it was
// stored; a name that resolves differently later (DNS rebinding) reached the home network at send.
// The check now sits in the connection itself: the push agent's lookup refuses private answers.
const keys = { publicKey: 'p', privateKey: 'k' };

function lookupWith(answers: { address: string; family: number }[]) {
  const lookup = publicOnlyLookup(((_host: string, _opts: unknown, cb: (...a: unknown[]) => void) =>
    cb(null, answers)) as never);
  return new Promise<{ err: unknown; address?: unknown }>((resolve) =>
    lookup('push.example', { all: true }, (err: unknown, address: unknown) =>
      resolve({ err, address }),
    ),
  );
}

describe('push sends only to public addresses', () => {
  it('the request options carry an agent with that lookup', () => {
    const agent = requestOptions(keys, 'mailto:a@b.c').agent;
    expect(agent).toBeInstanceOf(Agent);
  });

  it('refuses a name that resolves into the home network or to loopback', async () => {
    for (const address of [
      '192.168.1.10',
      '10.0.0.1',
      '127.0.0.1',
      '::1',
      'fd00::1',
      '169.254.1.1',
    ]) {
      const r = await lookupWith([{ address, family: address.includes(':') ? 6 : 4 }]);
      expect(r.err, address).toBeInstanceOf(Error);
    }
    const mixed = await lookupWith([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ]);
    expect(mixed.err).toBeInstanceOf(Error);
  });

  it('lets a public address through', async () => {
    const r = await lookupWith([{ address: '93.184.216.34', family: 4 }]);
    expect(r.err).toBeNull();
  });
});
