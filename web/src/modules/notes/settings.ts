import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  width: z.enum(['narrow', 'medium', 'full']),
  wordCount: z.boolean(),
});
export type NotesSettings = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { width: 'narrow', wordCount: true } satisfies NotesSettings,
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
  ],
};
