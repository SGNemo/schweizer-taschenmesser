import { describe, expect, it } from 'vitest';
import { visibleManifests } from '@/core/modules/registry';
import { writableModules } from '../prompt';
import { parseAnswer } from './answer';
import {
  downloadUrl,
  findModel,
  isVerifiable,
  LOCAL_MODELS,
  modelCardUrl,
  TEMPLATES,
  type TemplateId,
} from './catalogue';
import { buildGrammar } from './grammar';
import { EXAMPLE_TODAY, formatChat, pickExamples, systemPrompt, userMessage } from './prompts/v1';

const manifests = visibleManifests.filter((m) => m.id !== 'example');
const writable = writableModules(manifests);

describe('model catalogue', () => {
  it('lists only permissively licensed open weights with a source and size', () => {
    expect(LOCAL_MODELS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(LOCAL_MODELS.map((m) => m.id)).size).toBe(LOCAL_MODELS.length);
    expect(new Set(LOCAL_MODELS.map((m) => m.file)).size).toBe(LOCAL_MODELS.length);
    for (const m of LOCAL_MODELS) {
      expect(['apache-2.0', 'mit']).toContain(m.license.id);
      expect(m.bytes).toBeGreaterThan(100_000_000);
      expect(downloadUrl(m).startsWith('https://huggingface.co/')).toBe(true);
      expect(downloadUrl(m).endsWith(m.file)).toBe(true);
      expect(modelCardUrl(m)).toBe(`https://huggingface.co/${m.baseModel}`);
    }
    expect(LOCAL_MODELS.some((m) => m.profile === 'standard')).toBe(true);
    expect(LOCAL_MODELS.some((m) => m.profile === 'light')).toBe(true);
    expect(findModel('qwen3.5-4b')?.label).toBe('Qwen3.5 4B');
  });

  it('keeps the download locked until a checksum is pinned', () => {
    for (const m of LOCAL_MODELS) expect(isVerifiable(m)).toBe(m.sha256 !== null);
    const pinned = { ...LOCAL_MODELS[0]!, sha256: 'a'.repeat(64), revision: 'b'.repeat(40) };
    expect(isVerifiable(pinned)).toBe(true);
    expect(downloadUrl(pinned)).toContain(`/resolve/${'b'.repeat(40)}/`);
  });

  it('has a chat template for every model that fills system and user exactly once', () => {
    for (const m of LOCAL_MODELS) expect(TEMPLATES[m.template]).toBeDefined();
    for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
      const text = formatChat(id, 'SYS $& TEXT', 'USER {system}');
      expect(text).toContain('SYS $& TEXT'); // replacement patterns in the text stay literal
      expect(text).toContain('USER {system}');
      const plain = formatChat(id, 'S', 'U');
      expect(plain).not.toMatch(/\{(system|user)\}/); // nothing left unfilled
    }
  });
});

describe('prompt v1', () => {
  it('describes only writable modules – never the vault or modules without actions', () => {
    const text = systemPrompt(writable);
    for (const m of writable) expect(text).toContain(`${m.id}:`);
    expect(text).not.toMatch(/\naccounts:/);
    expect(text).not.toContain('"accounts"');
    expect(writable.every((m) => m.id !== 'accounts' && m.id !== 'disk')).toBe(true);
  });

  it('keeps the system part identical between requests and puts date and sentence last', () => {
    expect(systemPrompt(writable)).toBe(systemPrompt(writable));
    const a = userMessage('Rechnung Telekom 39,99 €', '2026-10-05');
    const b = userMessage('Abo Netflix 12,99 €', '2026-10-06');
    expect(a).toContain('Heute: 2026-10-05 (Montag)');
    expect(a).toContain('Eingabe: Rechnung Telekom 39,99 €');
    expect(systemPrompt(writable)).not.toContain('Telekom');
    expect(a).not.toBe(b);
    const chat = formatChat('chatml-nothink', systemPrompt(writable), a);
    expect(chat.indexOf(systemPrompt(writable))).toBeLessThan(chat.indexOf('Eingabe:'));
  });

  it('shows a handful of valid examples taken from the modules', () => {
    const examples = pickExamples(writable);
    expect(examples.length).toBeGreaterThanOrEqual(4);
    expect(examples.length).toBeLessThanOrEqual(6);
    for (const e of examples) {
      expect(e.input).toContain(`Heute: ${EXAMPLE_TODAY}`);
      const proposal = parseAnswer(e.output);
      expect(proposal?.ops.length).toBe(1);
      const op = proposal!.ops[0]!;
      const action = writable.find((m) => m.id === op.module)?.aiSchema?.actions?.[op.action];
      expect(action).toBeDefined();
      if (action!.kind !== 'create') expect(op.target?.title).toBeTruthy();
    }
    expect(new Set(examples.map((e) => JSON.parse(e.output).ops[0].action)).size).toBeGreaterThan(
      2,
    );
  });
});

describe('answer grammar', () => {
  const grammar = buildGrammar(writable);

  it('has a rule for every action and valid rule names', () => {
    for (const m of writable) {
      for (const id of Object.keys(m.aiSchema!.actions!)) {
        expect(grammar).toContain(`${m.id}-${id.toLowerCase()} ::=`);
      }
    }
    for (const line of grammar.split('\n')) {
      expect(line).toMatch(/^[a-z0-9-]+ ::= /);
    }
    expect(grammar).toContain('root ::=');
    expect(grammar).not.toContain('accounts');
  });

  it('bounds every repetition so an answer always ends', () => {
    for (const line of grammar.split('\n')) {
      const withoutLiterals = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\[[^\]]*\]/g, '[]');
      expect(withoutLiterals, line).not.toMatch(/[*+]/);
    }
  });

  it('types values: money and numbers as integers, dates, enums and recurrences', () => {
    expect(grammar).toMatch(/invoices-create-f ::= .*"\\"amountMinor\\":" int/);
    expect(grammar).toMatch(/invoices-create-f ::= .*"\\"dueDate\\":" date/);
    expect(grammar).toContain('("expense" | "income")');
    expect(grammar).toMatch(/subscriptions-create-f ::= .*"\\"recurrence\\":" recurrence/);
  });

  it('leaves the target out of creates and the data out of deletes', () => {
    const line = (name: string) => grammar.split('\n').find((l) => l.startsWith(`${name} ::=`))!;
    expect(line('todos-create')).not.toContain('target');
    expect(line('todos-delete')).toContain('target');
    expect(line('todos-delete')).not.toContain('data');
    expect(line('invoices-markpaid')).toContain('target');
  });
});

describe('parseAnswer', () => {
  const ok = (extra: object = {}) =>
    JSON.stringify({
      ops: [{ module: 'invoices', action: 'markPaid', target: 'Stadtwerke' }],
      confidence: 0.9,
      question: '',
      ...extra,
    });

  it('turns a valid answer into a stage-1 proposal with the target as words', () => {
    expect(parseAnswer(ok())).toEqual({
      ops: [{ module: 'invoices', action: 'markPaid', target: { title: 'Stadtwerke' } }],
      stage: 'local',
      confidence: 0.9,
    });
    expect(parseAnswer(ok({ question: ' Welcher Betrag? ' }))?.question).toBe('Welcher Betrag?');
  });

  it('refuses everything else', () => {
    expect(parseAnswer('')).toBeUndefined();
    expect(parseAnswer('Sure! {"ops":[]}')).toBeUndefined();
    expect(parseAnswer(ok({ ops: [] }))).toBeUndefined(); // "not a request to write"
    expect(parseAnswer(ok({ confidence: 1.5 }))).toBeUndefined();
    expect(parseAnswer(ok({ ops: [{ module: 'todos' }] }))).toBeUndefined();
    expect(parseAnswer('[]')).toBeUndefined();
  });
});
