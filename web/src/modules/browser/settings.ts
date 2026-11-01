import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';
import { DEFAULT_ENGINE, SEARCH_ENGINES } from './lib/searchEngines';

const schema = z.object({
  engine: z.string(),
  customUrl: z.string(),
  history: z.boolean(),
  httpWarning: z.boolean(),
  blocker: z.boolean(),
  hint: z.boolean(),
});

export type BrowserPrefs = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: {
    engine: DEFAULT_ENGINE,
    customUrl: '',
    history: true,
    httpWarning: true,
    blocker: true,
    hint: true,
  },
  keywords: ['Browser', 'Internet', 'Suche', 'Werbung', 'Tracker', 'Verlauf', 'Lesezeichen'],
  fields: [
    {
      key: 'engine',
      get label() {
        return t.browser.settings.engine;
      },
      type: 'select',
      get options() {
        return [
          ...SEARCH_ENGINES.map((e) => ({ value: e.id, label: e.name })),
          { value: 'custom', label: t.browser.settings.engineCustom },
        ];
      },
    },
    {
      key: 'customUrl',
      get label() {
        return t.browser.settings.customUrl;
      },
      type: 'text',
      get help() {
        return t.browser.settings.customUrlHelp;
      },
    },
    {
      key: 'history',
      get label() {
        return t.browser.settings.history;
      },
      type: 'boolean',
    },
    {
      key: 'httpWarning',
      get label() {
        return t.browser.settings.httpWarning;
      },
      type: 'boolean',
    },
    {
      key: 'blocker',
      get label() {
        return t.browser.settings.blocker;
      },
      type: 'boolean',
    },
    {
      key: 'hint',
      get label() {
        return t.browser.settings.hint;
      },
      type: 'boolean',
    },
  ],
};
