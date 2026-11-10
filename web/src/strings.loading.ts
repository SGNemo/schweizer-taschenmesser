import { defineBundle } from '@/core/i18n/bundle';

/**
 * A module page whose code takes long to arrive or failed to load (layout/PageLoadingCard). Calm: no error
 * wording, one way forward. German and English only (docs/i18n/FROZEN.md).
 */
export const tLoading = defineBundle(
  {
    still: 'Die Seite lädt noch.',
    drafts: 'Ungespeicherte Eingaben gehen verloren.',
  },
  {
    en: {
      still: 'The page is still loading.',
      drafts: 'Unsaved input will be lost.',
    },
  },
);
