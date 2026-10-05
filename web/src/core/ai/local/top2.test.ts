import { describe, expect, it } from 'vitest';
import { writableModules } from '../prompt';
import { evalManifests } from '../write/evalSupport';
import { buildTop2Grammar, parseTop2, top2SystemPrompt } from './top2';

const writable = writableModules(evalManifests);

describe('top-2 variant', () => {
  it('has a root with one or two alternatives and keeps the op rules', () => {
    const grammar = buildTop2Grammar(writable);
    expect(grammar).toMatch(/^root ::= "\{" "\\"alternatives\\":" "\[" alt \("," alt\)\? "\]\}"/);
    expect(grammar.match(/^root ::=/gm)).toHaveLength(1);
    expect(grammar).toContain('op ::=');
    expect(grammar).toContain('conf ::=');
  });

  it('describes alternatives in the prompt and in every example', () => {
    const prompt = top2SystemPrompt(writable);
    expect(prompt).toContain('"alternatives": the two most likely readings');
    const outputs = prompt.split('\n').filter((l) => l.startsWith('Ausgabe: '));
    expect(outputs.length).toBeGreaterThan(0);
    for (const line of outputs) expect(line).toMatch(/^Ausgabe: \{"alternatives":\[\{"ops":/);
    expect(prompt).not.toContain('"question":""}');
  });

  it('parses both readings and drops empty or invalid ones', () => {
    const text = JSON.stringify({
      alternatives: [
        { ops: [{ module: 'todos', action: 'create', data: { title: 'Milch' } }], confidence: 0.8 },
        { ops: [], confidence: 0.1 },
      ],
    });
    expect(parseTop2(text)).toHaveLength(1);
    const two = JSON.stringify({
      alternatives: [
        { ops: [{ module: 'todos', action: 'create' }], confidence: 0.6 },
        { ops: [{ module: 'lists', action: 'addItem' }], confidence: 0.4 },
      ],
    });
    expect(parseTop2(two).map((p) => p.ops[0]!.module)).toEqual(['todos', 'lists']);
    expect(parseTop2('not json')).toEqual([]);
  });
});
