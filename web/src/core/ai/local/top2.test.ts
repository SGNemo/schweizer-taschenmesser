import { describe, expect, it } from 'vitest';
import { writableModules } from '../prompt';
import { evalManifests } from '../write/evalSupport';
import { secondGrammar, withoutActions } from './top2';

const writable = writableModules(evalManifests);
const first = { ops: [{ module: 'todos', action: 'create' }] };

describe('second reading', () => {
  it('removes exactly the used action and keeps everything else', () => {
    const rest = withoutActions(writable, first);
    const todos = rest.find((m) => m.id === 'todos')!;
    expect(Object.keys(todos.aiSchema!.actions!)).not.toContain('create');
    expect(Object.keys(todos.aiSchema!.actions!).length).toBeGreaterThan(0);
    expect(rest.length).toBe(writable.length);
    // the originals are untouched
    expect(Object.keys(writable.find((m) => m.id === 'todos')!.aiSchema!.actions!)).toContain(
      'create',
    );
  });

  it('builds a grammar that can no longer produce the first answer', () => {
    const grammar = secondGrammar(writable, first)!;
    expect(grammar).not.toMatch(/^todos-create ::=/m);
    expect(grammar).toMatch(/^lists-/m);
    expect(grammar).toMatch(/^root ::=/m);
  });

  it('has nothing to offer when the first answer used the only action', () => {
    const only = writable.slice(0, 1).map((m) => ({
      ...m,
      aiSchema: {
        ...m.aiSchema!,
        actions: { only: Object.values(m.aiSchema!.actions!)[0]! },
      },
    }));
    expect(secondGrammar(only, { ops: [{ module: only[0]!.id, action: 'only' }] })).toBeUndefined();
  });
});
