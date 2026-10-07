import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tLegal } from '@/strings.legal';
import { DATA_FLOW_IDS, dataFlows } from './dataFlows';
import { findPlaceholders, LEGAL_IDENTITY } from './identity';
import { NOTICE_IDS } from './notices';

const flowsDoc = readFileSync(
  new URL('../../../../docs/legal/DATA-FLOWS.md', import.meta.url),
  'utf8',
);

describe('legal identity', () => {
  it('has no invented details: every personal value is an open [[PLACEHOLDER]] or empty', () => {
    for (const [key, value] of Object.entries(LEGAL_IDENTITY)) {
      if (value === '') continue;
      expect(findPlaceholders(value), key).toHaveLength(1);
    }
  });

  it('finds distinct placeholders', () => {
    expect(findPlaceholders('[[A]] x [[B_1]] [[A]] [c]')).toEqual(['[[A]]', '[[B_1]]']);
  });
});

describe('data flows', () => {
  it('describe what, to whom and when for every id', () => {
    expect(dataFlows().map((f) => f.id)).toEqual([...DATA_FLOW_IDS]);
    for (const f of dataFlows()) {
      expect(f.title, f.id).not.toBe('');
      expect(f.what, f.id).not.toBe('');
      expect(f.to, f.id).not.toBe('');
      expect(f.when, f.id).not.toBe('');
    }
  });

  it('are all in docs/legal/DATA-FLOWS.md (the table the website and README are checked against)', () => {
    for (const id of DATA_FLOW_IDS) expect(flowsDoc, id).toContain(`\`${id}\``);
  });

  it('name the facts the code guarantees: scopes, no entries to AI, update opt-out', () => {
    const all = dataFlows();
    const text = (id: string) => JSON.stringify(all.find((f) => f.id === id));
    expect(text('google')).toContain('calendar.readonly');
    expect(text('google')).toContain('gmail.readonly');
    expect(text('google')).toContain('7 Tagen');
    expect(text('ai-cloud')).toContain('Nie deine Einträge');
    expect(text('update')).toContain('Automatisch nach Updates suchen');
  });
});

describe('one-time notices', () => {
  it('have a short text for every id', () => {
    for (const id of NOTICE_IDS) {
      const n = tLegal.de.notices[id];
      expect(n.title, id).not.toBe('');
      expect(n.body.length, id).toBeLessThanOrEqual(2);
    }
  });
});

describe('English bundle', () => {
  it('has the same data flows and notices and no leftover German headings', () => {
    expect(Object.keys(tLegal.en.flows)).toEqual(Object.keys(tLegal.de.flows));
    for (const id of NOTICE_IDS)
      expect(tLegal.en.notices[id].title, id).not.toBe(tLegal.de.notices[id].title);
    expect(dataFlows(tLegal.en).map((f) => f.id)).toEqual([...DATA_FLOW_IDS]);
  });
});
