import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const s = t.chat.settings;

export const KEEP_OPTIONS = ['0', '30', '90', '365'] as const;

const schema = z.object({
  defaultEngine: z.enum(['local', 'router']),
  /** Days after which unused, unpinned chats are deleted; '0' = never. */
  keepDays: z.enum(KEEP_OPTIONS),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { defaultEngine: 'router', keepDays: '0' },
  fields: [
    {
      key: 'defaultEngine',
      get label() {
        return s.defaultEngine;
      },
      type: 'select',
      options: [
        {
          value: 'router',
          get label() {
            return t.chat.engineRouter;
          },
        },
        {
          value: 'local',
          get label() {
            return t.chat.engineLocal;
          },
        },
      ],
    },
    {
      key: 'keepDays',
      get label() {
        return s.keepDays;
      },
      type: 'select',
      options: KEEP_OPTIONS.map((v) => ({
        value: v,
        label: v === '0' ? s.keepForever : s.keepDaysOption(Number(v)),
      })),
      get help() {
        return s.keepHint;
      },
    },
  ],
};
