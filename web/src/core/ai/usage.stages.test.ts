import { describe, expect, it } from 'vitest';
import { dailyByStage, totalsByProvider, totalsByStage, totalsOf, type UsageRow } from './usage';

const at = (day: number, hour = 10) => new Date(2026, 8, day, hour).getTime();
const row = (over: Partial<UsageRow>): UsageRow => ({
  at: at(29),
  provider: 'claude',
  model: 'claude-haiku-4-5',
  inputTokens: 0,
  outputTokens: 0,
  cacheHit: false,
  ...over,
});

const rows: UsageRow[] = [
  row({ provider: 'rules', model: 'rules', stage: 'rule' }),
  row({ provider: 'rules', model: 'rules', stage: 'rule' }),
  row({ provider: 'rules', model: 'rules', stage: 'rule', at: at(28) }),
  row({ provider: 'local', model: 'local-model', stage: 'local' }),
  row({ inputTokens: 600, outputTokens: 40, stage: 'cloud' }),
  row({ inputTokens: 500, outputTokens: 30 }), // older row without a stage = cloud
  row({ cacheHit: true, stage: 'cache' }),
  row({ outcome: 'error', errorCode: 'rate-limit' }),
];

describe('usage per stage', () => {
  it('counts answers per stage; failed provider attempts are no answers', () => {
    const s = totalsByStage(rows);
    expect(s.rule.answers).toBe(3);
    expect(s.local.answers).toBe(1);
    expect(s.cloud.answers).toBe(2);
    expect(s.cache.answers).toBe(1);
    expect(s.cloud.inputTokens).toBe(1100);
    expect(s.cloud.outputTokens).toBe(70);
    expect(s.rule.inputTokens + s.rule.outputTokens + s.local.inputTokens).toBe(0);
  });

  it('prices only cloud answers', () => {
    const s = totalsByStage(rows);
    // Haiku 4.5: $1 / $5 per million tokens.
    expect(s.cloud.costUsd).toBeCloseTo((1100 * 1 + 70 * 5) / 1_000_000, 8);
    expect(s.rule.costUsd).toBe(0);
  });

  it('keeps rule and local answers out of the provider totals', () => {
    const total = totalsOf(rows);
    expect(total.requests).toBe(2);
    expect(total.cacheHits).toBe(1);
    expect(total.errors).toBe(1);
    expect([...totalsByProvider(rows).keys()]).toEqual(['claude']);
  });

  it('groups by local day, newest first', () => {
    const days = dailyByStage(rows);
    expect(days.map((d) => d.day)).toEqual(['2026-09-29', '2026-09-28']);
    expect(days[0]!.stages.rule.answers).toBe(2);
    expect(days[1]!.stages.rule.answers).toBe(1);
  });
});
