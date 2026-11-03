import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const SORTS = ['newest', 'title', 'kind', 'status'] as const;
export type SortMode = (typeof SORTS)[number];

export const settingsSchema = z.object({
  view: z.enum(['list', 'cards']),
  sort: z.enum(SORTS),
  /** Fetch title, description and picture of a saved link from the page itself. Off until chosen. */
  linkPreview: z.boolean(),
});
export type BookmarksSettings = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { view: 'list', sort: 'newest', linkPreview: false } satisfies BookmarksSettings,
  fields: [
    {
      key: 'view',
      get label() {
        return t.bookmarks.meta.settings.view;
      },
      get help() {
        return t.bookmarks.meta.settings.viewHelp;
      },
      type: 'select',
      get options() {
        return [
          { value: 'list', label: t.bookmarks.viewList },
          { value: 'cards', label: t.bookmarks.viewCards },
        ];
      },
    },
    {
      key: 'sort',
      get label() {
        return t.bookmarks.meta.settings.sort;
      },
      get help() {
        return t.bookmarks.meta.settings.sortHelp;
      },
      type: 'select',
      get options() {
        return SORTS.map((value) => ({ value, label: t.bookmarks.sorts[value] }));
      },
    },
    {
      key: 'linkPreview',
      get label() {
        return t.bookmarks.meta.settings.linkPreview;
      },
      get help() {
        return t.bookmarks.meta.settings.linkPreviewHint;
      },
      type: 'boolean',
    },
  ],
};
