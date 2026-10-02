import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { visibleManifests } from '@/core/modules/registry';
import { CORE_IDS, clearAll, ctxFor, seed, TODAY, useFixedClock } from './testing';
import {
  buildSchemaText,
  buildSystemPrompt,
  buildTools,
  buildUserMessage,
  intentFromToolCall,
  InvalidModelAnswer,
  schemaHash,
} from './prompt';

const manifests = ctxFor().manifests;

beforeEach(async () => {
  useFixedClock();
  await clearAll();
});
afterAll(() => setNow());

/** Rough token estimate: ~3.5 characters per token for German/JSON. */
const tokens = (s: string) => Math.ceil(s.length / 3.5);

describe('prompt', () => {
  it('stays within a token budget for all core modules', () => {
    const system = buildSystemPrompt(manifests);
    const total =
      tokens(system) +
      tokens(JSON.stringify(buildTools(manifests))) +
      tokens(buildUserMessage('Wie hoch waren meine Ausgaben für Lebensmittel?', TODAY));
    expect(tokens(buildSchemaText(manifests))).toBeLessThan(700);
    expect(total).toBeLessThan(2000);
  });

  it('describes required fields and computed views compactly', () => {
    const text = buildSchemaText(manifests);
    expect(text).toContain('invoices: Rechnungen');
    expect(text).toMatch(
      /invoice\[Rechnung\] .*payee:text!.*amountMinor:money!.*dueDate:date@!.*status:enum\(open\|paid\)/,
    );
    expect(text).toMatch(/event\[Termin\] .*recurrence:recurrence/);
    expect(text).not.toMatch(/event\[Termin\] .*recurrence:recurrence!/); // optional there
    expect(text).toMatch(/subscription\[Abo\] .*recurrence:recurrence!/); // required there
    expect(text).toContain('computed: balance (');
  });

  it('only mentions enabled modules', () => {
    const only = ctxFor(['todos']).manifests;
    expect(buildSchemaText(only)).not.toContain('invoices');
    const tools = JSON.stringify(buildTools(only));
    expect(tools).toContain('"todos"');
    expect(tools).not.toContain('"invoices"');
    expect(buildTools(only).map((t) => t.name)).toEqual([
      'run_query',
      'show_agenda',
      'create_entry',
    ]); // no computed views there
  });

  it('never contains user data, only question, date and schemas', async () => {
    await seed();
    const everything = [
      buildSystemPrompt(manifests),
      JSON.stringify(buildTools(manifests)),
      buildUserMessage('Was steht morgen an?', TODAY),
    ].join('\n');
    for (const secret of [
      'Geheimfirma',
      'Sonnenschein',
      'Stadtwerke Musterstadt',
      'Vodafone',
      'Netflix',
      'Arbeitgeber',
      '8990',
      '250000',
    ]) {
      expect(everything).not.toContain(secret);
    }
    expect(everything).toContain('2026-09-29 (Dienstag)');
  });

  it('hash changes with the module set, not with the question', () => {
    expect(schemaHash(manifests)).toBe(schemaHash(ctxFor(CORE_IDS).manifests));
    expect(schemaHash(manifests)).not.toBe(schemaHash(ctxFor(['todos']).manifests));
    expect(schemaHash(visibleManifests)).toMatch(/^[0-9a-f]+$/);
  });
});

describe('intentFromToolCall', () => {
  it('validates each tool and applies defaults', () => {
    expect(
      intentFromToolCall({ name: 'run_query', input: { module: 'todos', collection: 'task' } }),
    ).toEqual({
      type: 'query',
      query: { module: 'todos', collection: 'task', filters: [], limit: 20 },
    });
    expect(intentFromToolCall({ name: 'show_agenda', input: { relative: 'today' } })).toEqual({
      type: 'agenda',
      agenda: { relative: 'today' },
    });
    expect(
      intentFromToolCall({ name: 'run_computed', input: { module: 'finance', name: 'balance' } }),
    ).toEqual({ type: 'computed', module: 'finance', name: 'balance' });
    expect(
      intentFromToolCall({
        name: 'create_entry',
        input: { module: 'todos', collection: 'task', data: { title: 'x' } },
      }).type,
    ).toBe('create');
  });

  it('rejects malformed model output', () => {
    const bad = [
      { name: 'run_query', input: { module: 'todos' } },
      {
        name: 'run_query',
        input: {
          module: 'todos',
          collection: 'task',
          filters: [{ field: 'done', op: 'like', value: 'x' }],
        },
      },
      { name: 'run_query', input: { module: 'todos', collection: 'task', limit: 5000 } },
      {
        name: 'run_query',
        input: { module: 'todos', collection: 'task', aggregate: 'avg:priority' },
      },
      { name: 'show_agenda', input: {} },
      { name: 'show_agenda', input: { relative: 'someday' } },
      { name: 'delete_everything', input: {} },
      { name: 'create_entry', input: 'nope' },
    ];
    for (const call of bad)
      expect(() => intentFromToolCall(call), JSON.stringify(call)).toThrow(InvalidModelAnswer);
  });
});
