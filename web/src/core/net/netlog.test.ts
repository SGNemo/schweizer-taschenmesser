// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertNetworkAllowed,
  clearNetLog,
  describeRequest,
  loggedFetch,
  MAX_NET_ENTRIES,
  NetBlockedError,
  recordNet,
  setKeepNetLog,
  setNetworkBlocked,
  useNetLog,
} from './netlog';

const ok = (async () =>
  new Response('{"a":1}', { status: 200, headers: { 'content-length': '7' } })) as typeof fetch;

beforeEach(() => {
  localStorage.clear();
  setNetworkBlocked(false);
  setKeepNetLog(false);
  clearNetLog();
});

describe('describeRequest', () => {
  it('names host and reason, never the path or query', () => {
    expect(
      describeRequest('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2'),
    ).toEqual({
      host: 'api.open-meteo.com',
      reason: 'weather',
    });
    expect(describeRequest('https://api.github.com/repos/x/y/releases').reason).toBe('update');
    expect(describeRequest('http://localhost:11434/api/tags')).toEqual({
      host: 'localhost:11434',
      reason: 'ai',
    });
    expect(
      describeRequest('https://sync.example.test/v1/proxy?url=https%3A%2F%2Fcal.test%2Fx.ics'),
    ).toEqual({
      host: 'sync.example.test',
      reason: 'calendar',
    });
    expect(describeRequest('https://sync.example.test/v1/pull?since=3').reason).toBe('sync');
    expect(describeRequest('https://elsewhere.example.test/x').reason).toBe('other');
  });
});

describe('loggedFetch', () => {
  it('lists host, reason, size and status – and nothing of the content', async () => {
    await loggedFetch(ok)('https://api.frankfurter.dev/v1/latest?base=EUR&secret=abc', {
      method: 'POST',
      headers: { authorization: 'Bearer geheim' },
      body: 'hallo',
    });
    const [entry] = useNetLog.getState().entries;
    expect(entry).toMatchObject({
      host: 'api.frankfurter.dev',
      reason: 'currency',
      out: 5,
      in: 7,
      status: 200,
    });
    const text = JSON.stringify(entry);
    for (const forbidden of ['secret', 'abc', 'geheim', 'Bearer', 'hallo', '/v1/latest', 'EUR'])
      expect(text).not.toContain(forbidden);
  });

  it('notes a failed request and passes the error on', async () => {
    const failing = (async () => Promise.reject(new TypeError('offline'))) as typeof fetch;
    await expect(loggedFetch(failing)('https://api.ipify.org')).rejects.toThrow('offline');
    expect(useNetLog.getState().entries[0]).toMatchObject({ reason: 'ip', status: 'error' });
  });

  it('refuses everything while blocked, before anything is sent', async () => {
    let sent = false;
    const inner = (async () => {
      sent = true;
      return new Response('x');
    }) as typeof fetch;
    setNetworkBlocked(true);
    await expect(loggedFetch(inner)('http://localhost:11434/api/tags')).rejects.toBeInstanceOf(
      NetBlockedError,
    );
    expect(sent).toBe(false);
    expect(useNetLog.getState().entries[0]).toMatchObject({ status: 'blocked' });
    setNetworkBlocked(false);
    await loggedFetch(inner)('https://api.ipify.org');
    expect(sent).toBe(true);
  });

  it('assertNetworkAllowed lists native requests and blocks them with the switch', () => {
    assertNetworkAllowed('github.com', 'update');
    expect(useNetLog.getState().entries[0]).toMatchObject({ status: 'native', reason: 'update' });
    setNetworkBlocked(true);
    expect(() => assertNetworkAllowed('github.com', 'update')).toThrow(NetBlockedError);
  });
});

describe('storage', () => {
  it('keeps the list in memory unless the person opts in, and caps it', () => {
    recordNet({ host: 'a.test', reason: 'other', out: 0, status: 200 });
    expect(localStorage.getItem('tm-net-log')).toBeNull();
    setKeepNetLog(true);
    expect(JSON.parse(localStorage.getItem('tm-net-log')!)).toHaveLength(1);
    for (let i = 0; i < MAX_NET_ENTRIES + 5; i++)
      recordNet({ host: `h${i}.test`, reason: 'other', out: 0, status: 200 });
    expect(useNetLog.getState().entries).toHaveLength(MAX_NET_ENTRIES);
    expect(JSON.parse(localStorage.getItem('tm-net-log')!)).toHaveLength(MAX_NET_ENTRIES);
    setKeepNetLog(false);
    expect(localStorage.getItem('tm-net-log')).toBeNull();
  });
});
