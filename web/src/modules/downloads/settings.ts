import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

// Synced: limits only. The torrent switch, DHT, UPnP and the default folder are device-local
// (`devicePrefs.ts`, security review 2026-11, DL10); old synced values of them are ignored.
const schema = z.object({
  limitKb: z.number().min(0),
  torrentUpKb: z.number().min(0),
  torrentDownKb: z.number().min(0),
  seedRatio: z.number().min(0),
  seedMinutes: z.number().min(0),
});

export type DownloadsPrefs = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: {
    limitKb: 0,
    torrentUpKb: 0,
    torrentDownKb: 0,
    seedRatio: 1,
    seedMinutes: 0,
  },
  fields: [
    {
      key: 'limitKb',
      get label() {
        return t.downloads.settings.limitKb;
      },
      type: 'number',
    },
    {
      key: 'torrentUpKb',
      get label() {
        return t.downloads.settings.torrentUpKb;
      },
      type: 'number',
    },
    {
      key: 'torrentDownKb',
      get label() {
        return t.downloads.settings.torrentDownKb;
      },
      type: 'number',
    },
    {
      key: 'seedRatio',
      get label() {
        return t.downloads.settings.seedRatio;
      },
      type: 'number',
    },
    {
      key: 'seedMinutes',
      get label() {
        return t.downloads.settings.seedMinutes;
      },
      type: 'number',
    },
  ],
};
