import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const schema = z.object({
  limitKb: z.number().min(0),
  folder: z.string(),
  // BitTorrent part: off until the user switches it on (after the notice).
  torrent: z.boolean(),
  torrentDht: z.boolean(),
  torrentUpnp: z.boolean(),
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
    folder: '',
    torrent: false,
    torrentDht: true,
    torrentUpnp: false,
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
      key: 'folder',
      get label() {
        return t.downloads.settings.folder;
      },
      type: 'text',
    },
    {
      key: 'torrent',
      get label() {
        return t.downloads.settings.torrent;
      },
      type: 'boolean',
    },
    {
      key: 'torrentDht',
      get label() {
        return t.downloads.settings.torrentDht;
      },
      type: 'boolean',
    },
    {
      key: 'torrentUpnp',
      get label() {
        return t.downloads.settings.torrentUpnp;
      },
      type: 'boolean',
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
