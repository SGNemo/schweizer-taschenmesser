import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description sent to the LLM (stage 2). Keep it tiny; it never contains user data. */
export const aiSchema: ModuleAiSchema = {
  description: '__NAME__ entries',
  collections: {
    entry: {
      label: 'Eintrag',
      fields: { title: 'text', done: 'bool', note: 'text' },
      titleField: 'title',
      searchable: ['title', 'note'],
    },
  },
  // Optional: lets the assistant add, change, delete or mark entries (always after a preview and
  // the user's confirmation). Without `actions` the module stays read-only for the assistant. See
  // docs/howto/ai-actions.md. Examples are run through rules → preview → undo by the registry test;
  // every update/delete/transition example needs a `target` (the title the `create` example makes).
  // actions: {
  //   create: {
  //     kind: 'create',
  //     collection: 'entry',
  //     label: 'Eintrag anlegen',
  //     description: 'Neuer Eintrag mit Titel',
  //     fields: ['title', 'note'],
  //     required: ['title'],
  //     parse: { keywords: ['eintrag'] },
  //     examples: [{ input: 'Lege den Eintrag Beispiel an', output: { title: 'Beispiel' } }],
  //   },
  //   delete: {
  //     kind: 'delete',
  //     collection: 'entry',
  //     label: 'Eintrag löschen',
  //     description: 'Eintrag löschen',
  //     examples: [{ input: 'Lösche den Eintrag Beispiel', target: 'Beispiel', output: {} }],
  //   },
  // },
};
