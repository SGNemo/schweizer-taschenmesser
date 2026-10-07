import { describe, expect, it } from 'vitest';
import { validateAiActions } from './aiActions';
import type { AiActionDef, ModuleAiSchema } from './types';

const create: AiActionDef = {
  kind: 'create',
  collection: 'entry',
  label: 'Eintrag anlegen',
  description: 'Neuer Eintrag',
  fields: ['title', 'note'],
  required: ['title'],
  parse: { keywords: ['eintrag'] },
  examples: [{ input: 'Eintrag Test', output: { title: 'Test' } }],
};

const schema = (actions?: Record<string, AiActionDef>): ModuleAiSchema => ({
  description: 'x',
  collections: {
    entry: { label: 'Eintrag', fields: { title: 'text', note: 'text' }, titleField: 'title' },
  },
  actions,
});

describe('validateAiActions', () => {
  it('accepts modules without actions and complete ones', () => {
    expect(validateAiActions(undefined)).toEqual([]);
    expect(validateAiActions(schema())).toEqual([]);
    expect(
      validateAiActions(
        schema({
          create,
          delete: {
            kind: 'delete',
            collection: 'entry',
            label: 'Löschen',
            description: 'Eintrag löschen',
            examples: [{ input: 'Lösche Eintrag Test', target: 'Test', output: {} }],
          },
        }),
      ),
    ).toEqual([]);
  });

  it.each<[string, Partial<AiActionDef>, string]>([
    ['an unknown collection', { collection: 'nope' }, 'not in aiSchema.collections'],
    ['an unknown field', { fields: ['title', 'ghost'] }, '"ghost" is not an aiSchema field'],
    ['a required field outside fields', { required: ['note'], fields: ['title'] }, 'not in fields'],
    ['no examples', { examples: [] }, 'at least one example'],
    ['no fields on create', { fields: [], required: [] }, 'create needs fields'],
    ['empty keywords', { parse: { keywords: [] } }, 'keywords is empty'],
  ])('rejects %s', (_name, patch, message) => {
    expect(validateAiActions(schema({ create: { ...create, ...patch } })).join('\n')).toContain(
      message,
    );
  });

  it('needs a create action and targets for the other kinds', () => {
    const del: AiActionDef = {
      kind: 'delete',
      collection: 'entry',
      label: 'Löschen',
      description: 'Eintrag löschen',
      examples: [{ input: 'Lösche Eintrag Test', output: {} }],
    };
    const errors = validateAiActions(schema({ delete: del })).join('\n');
    expect(errors).toContain('needs a create action');
    expect(errors).toContain('every example needs a target');
  });

  it('requires a patch for transitions and no fields for deletions', () => {
    const base = {
      collection: 'entry',
      label: 'x',
      description: 'y',
      examples: [{ input: 'a', target: 'T', output: {} }],
    };
    expect(
      validateAiActions(schema({ create, done: { ...base, kind: 'transition' } })).join('\n'),
    ).toContain('transition needs set');
    expect(
      validateAiActions(
        schema({ create, del: { ...base, kind: 'delete', fields: ['title'] } }),
      ).join('\n'),
    ).toContain('delete takes no fields');
  });
});
