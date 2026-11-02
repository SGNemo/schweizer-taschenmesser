import { z } from 'zod';
import type { ModuleSettings, SettingField } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
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

/** Settings that steer the embedded desktop tabs; Custom Tabs on Android have the system's own. */
const DESKTOP_ONLY = new Set(['httpWarning', 'blocker', 'hint']);

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
  keywords: ['Browser', 'Internet', 'Suche', 'Werbung', 'Tracker'],
  get fields() {
    return ALL_FIELDS.filter((f) => getPlatform().kind !== 'android' || !DESKTOP_ONLY.has(f.key));
  },
};

const ALL_FIELDS: SettingField[] = [
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
];
