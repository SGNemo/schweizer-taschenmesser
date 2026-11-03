import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  width: z.enum(['narrow', 'medium', 'full']),
  wordCount: z.boolean(),
  view: z.enum(['list', 'cards']),
});
export type NotesSettings = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { width: 'narrow', wordCount: true, view: 'list' } satisfies NotesSettings,
  fields: [
    {
      key: 'width',
      get label() {
        return t.notes.meta.settings.width;
      },
      type: 'select',
      get options() {
        const s = t.notes.meta.settings;
        return [
          { value: 'narrow', label: s.widthNarrow },
          { value: 'medium', label: s.widthMedium },
          { value: 'full', label: s.widthFull },
        ];
      },
    },
    {
      key: 'wordCount',
      get label() {
        return t.notes.meta.settings.wordCount;
      },
      type: 'boolean',
    },
    {
      key: 'view',
      get label() {
        return t.notes.meta.settings.view;
      },
      get help() {
        return t.notes.meta.settings.viewHelp;
      },
      type: 'select',
      get options() {
        return [
          { value: 'list', label: t.notes.view.list },
          { value: 'cards', label: t.notes.view.cards },
        ];
      },
    },
  ],
};
