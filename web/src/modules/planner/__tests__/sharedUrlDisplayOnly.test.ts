import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import { webAddress } from '@/core/net/webAddress';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { copyInput } from '../copyPlan';
import { planAsText } from '../pastePlan';
import { plannerRepos } from '../repo';
import { buildInputs, runPlanner, type RunDeps } from '../run';
import { DEFAULT_PLANNER_SETTINGS } from '../settings';

/**
 * A shared address is display only (planner hub 2, package 1): the chip S7 – never the input hash, never a reason to plan
 * again, never in „Plan als Text kopieren“. And the one gate it passes everywhere: http/https, ≤ 2 048, a host.
 */
const TODAY = '2026-11-09';
const NOW = new Date(2026, 10, 9, 10, 0).getTime();
const URL_ = 'https://example.org/fahrradtraeger';

const plain: PlannableEntry[] = [
  {
    moduleId: 'todos',
    id: 'a',
    kind: 'task',
    title: 'Fahrradträger',
    to: '/todos?open=a',
    durationMin: 30,
    priority: 0,
    createdAt: 1,
  },
];
const withUrl = (url: string): PlannableEntry[] => [{ ...plain[0]!, url }];

const deps = (database: RunDeps['database'], entries: PlannableEntry[]): RunDeps => ({
  database,
  today: TODAY,
  manifests: [],
  settings: { ...DEFAULT_PLANNER_SETTINGS, horizonDays: '7' as const },
  planLimit: 3,
  settled: true,
  entries,
  calendar: [],
  writer: { onAssign: vi.fn(async () => undefined), onRelease: vi.fn(async () => undefined) },
});

beforeEach(() => setNow(() => NOW));
afterEach(() => setNow());

describe('a shared address is display only', () => {
  it('the input hash and the engine items are the same with and without it', async () => {
    const database = createTestDb();
    const a = await buildInputs(deps(database, plain), plannerRepos(database));
    const b = await buildInputs(deps(database, withUrl(URL_)), plannerRepos(database));
    expect(b.hash).toBe(a.hash);
    expect(b.items).toEqual(a.items);
    expect(JSON.stringify(b.items)).not.toContain('example.org');
    await database.delete();
  });

  it('an address that arrives later is no reason to plan again', async () => {
    const database = createTestDb();
    await runPlanner(deps(database, plain), { force: true, reshuffle: true });
    const again = await runPlanner(deps(database, withUrl(URL_)));
    expect(again.ran).toBe(false);
    await database.delete();
  });

  it('never in „Plan als Text kopieren“', () => {
    const entry = withUrl(URL_)[0]!;
    const input = copyInput(
      [
        {
          date: TODAY,
          rows: [
            { itemKey: 'todos:a', title: entry.title, minutes: 30, approx: false, entry } as never,
          ],
        },
      ],
      [],
      [],
      { from: TODAY, to: TODAY },
    );
    const words = {
      goal: (g: string) => g,
      day: (d: string) => d,
      week: 'w',
      later: 'l',
      minutes: (m: number) => `${m} Min`,
      fixed: (title: string) => title,
    };
    const text = planAsText(input, words);
    expect(text).toContain('Fahrradträger');
    expect(text).not.toContain('example.org');
  });
});

describe('webAddress – the one gate', () => {
  it('http/https only, ≤ 2 048, no user info, one address and nothing else; the host as URL reads it', () => {
    expect(webAddress(URL_)).toEqual({ url: URL_, host: 'example.org' });
    expect(webAddress('http://example.org')?.host).toBe('example.org');
    for (const bad of [
      'www.example.org/x',
      'javascript:alert(1)',
      'intent://x#Intent;end',
      'file:///etc/hosts',
      'https://user:pw@example.org/',
      'https://example.org/a b',
      'Schau mal https://example.org',
      `https://example.org/${'a'.repeat(2048)}`,
      '',
      undefined,
    ])
      expect(webAddress(bad)).toBeUndefined();
    // A non-ASCII host is shown as URL reads it (punycode), never as typed.
    expect(webAddress('https://bücher.example/')?.host).toBe('xn--bcher-kva.example');
  });
});
