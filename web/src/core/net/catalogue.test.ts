import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NET_CATALOGUE } from './catalogue';
import { describeRequest, type NetReason } from './netlog';

const SRC = resolve(__dirname, '../..');
const SKIP_DIRS = new Set(['__tests__', '__fixtures__', 'fixtures', 'locales']);

/** Every `http(s)://host` literal in the app's source, with the files it is in (tests and texts left out). */
function hostsInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(name) || /\.test\.|\.d\.ts$|^strings/.test(name)) continue;
      const text = readFileSync(path, 'utf8');
      for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,}|localhost)(:\d+)?/gi)) {
        const host = `${m[1]!.toLowerCase()}${m[2] ?? ''}`;
        found.set(host, [...(found.get(host) ?? []), path.slice(SRC.length + 1)]);
      }
    }
  };
  walk(SRC);
  return found;
}

const listed = new Map<string, NetReason>(
  NET_CATALOGUE.flatMap((u) => u.hosts.map((h) => [h, u.reason] as const)),
);
const reasonOf = (host: string) => describeRequest(`https://${host}/`).reason;

describe('"Was geht ins Netz" is derived from the code (D09)', () => {
  const source = hostsInSource();

  it('lists every address in the code that the connection log files under a reason', () => {
    const missing = [...source.keys()]
      .filter((host) => reasonOf(host) !== 'other' && listed.get(host) !== reasonOf(host))
      .map((host) => `${host} (${reasonOf(host)}) in ${source.get(host)!.join(', ')}`);
    expect(missing).toEqual([]);
  });

  it('lists nothing that is no longer in the code, each under the reason the log uses', () => {
    for (const [host, reason] of listed) {
      expect([host, source.has(host)]).toEqual([host, true]);
      expect([host, reasonOf(host)]).toEqual([host, reason]);
    }
  });

  it('names every reason of the connection log once', () => {
    const reasons = NET_CATALOGUE.map((u) => u.reason);
    expect(new Set(reasons).size).toBe(reasons.length);
    const all: NetReason[] = [
      'update',
      'sync',
      'push',
      'calendar',
      'connector',
      'ai',
      'weather',
      'maps',
      'currency',
      'ip',
      'breach',
      'download',
      'other',
    ];
    expect([...reasons].sort()).toEqual([...all].sort());
  });

  it('only the update check runs without a click or a setup', () => {
    expect(NET_CATALOGUE.filter((u) => u.when === 'auto').map((u) => u.reason)).toEqual(['update']);
  });
});
