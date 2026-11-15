import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const SORTS = ['newest', 'title', 'kind', 'status'] as const;
export type SortMode = (typeof SORTS)[number];

/** How the list is grouped: by when it was saved (default), by first tag ("Sammlung") or by type. */
export const GROUPINGS = ['recent', 'tag', 'kind'] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const settingsSchema = z.object({
  view: z.enum(['list', 'cards']),
  sort: z.enum(SORTS),
  /** Kept across visits, so a list grouped by tag stays that way. */
  groupBy: z.enum(GROUPINGS),
  /** Fetch title, description and picture of a saved link from the page itself. Off until chosen. */
  linkPreview: z.boolean(),
});
export type BookmarksSettings = z.output<typeof settingsSchema>;

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: {
    view: 'list',
    sort: 'newest',
    groupBy: 'recent',
    linkPreview: false,
  } satisfies BookmarksSettings,
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
      key: 'groupBy',
      get label() {
        return t.bookmarks.meta.settings.groupBy;
      },
      get help() {
        return t.bookmarks.meta.settings.groupByHelp;
      },
      type: 'select',
      get options() {
        return GROUPINGS.map((value) => ({ value, label: t.bookmarks.groupings[value] }));
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
