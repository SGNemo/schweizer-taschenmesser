import { describe, expect, it } from 'vitest';
import { connectors } from '@/core/connectors/registry';
import { allManifests } from '@/core/modules/registry';
import { allTools } from '@/core/tools/registry';
import {
  allSetupSteps,
  applicableSteps,
  collectSetupSteps,
  detectDone,
  validateSetupSteps,
} from './registry';
import type { SetupCtx, SetupStepDef } from './types';

const ctx: SetupCtx = { modules: { todos: true, notes: false }, platform: 'web', isNative: false };
const step = (id: string, extra: Partial<SetupStepDef> = {}): SetupStepDef => ({
  id,
  title: id,
  description: id,
  order: 100,
  since: 1,
  component: async () => ({ default: () => null }),
  ...extra,
});

describe('setup step registry', () => {
  it('all registered steps are valid and unique', () => {
    expect(validateSetupSteps([...allManifests, ...allTools, ...connectors], [])).toEqual([]);
    expect(new Set(allSetupSteps.map((s) => s.id)).size).toBe(allSetupSteps.length);
  });

  it('requires module steps to carry the module id as prefix and ids to be unique', () => {
    const errors = validateSetupSteps(
      [{ id: 'todos', setupSteps: [step('notes.x'), step('todos.a'), step('todos.a')] }],
      [step('todos.a')],
    );
    expect(errors.some((e) => e.includes('must start with "todos."'))).toBe(true);
    expect(errors.some((e) => e.includes('used twice'))).toBe(true);
  });

  it('merges core and contributed steps in order', () => {
    const out = collectSetupSteps(
      [{ id: 'todos', setupSteps: [step('todos.b', { order: 5 })] }],
      [step('core.a', { order: 10 }), step('core.b', { order: 5 })],
    );
    expect(out.map((s) => s.id)).toEqual(['core.b', 'todos.b', 'core.a']);
  });

  it('filters by condition, and a throwing condition hides only its own step', async () => {
    const steps = [
      step('todos.a', { when: (c) => c.modules.todos === true }),
      step('notes.a', { when: (c) => c.modules.notes === true }),
      step('bad.a', { when: () => Promise.reject(new Error('boom')) }),
      step('always'),
    ];
    expect((await applicableSteps(steps, ctx)).map((s) => s.id)).toEqual(['todos.a', 'always']);
  });

  it('recognises steps that were completed elsewhere', async () => {
    const steps = [
      step('a', { isDone: async () => true }),
      step('b', { isDone: async () => false }),
      step('c', { isDone: async () => Promise.reject(new Error('x')) }),
    ];
    expect([...(await detectDone(steps, ctx))]).toEqual(['a']);
  });
});
