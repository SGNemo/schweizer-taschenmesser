import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  refreshMinutes: z.enum(['30', '60', '180']),
  /** Only articles containing one of these words (comma separated). Empty = everything. */
  keywords: z.string(),
  /** Articles containing one of these words are hidden. */
  muted: z.string(),
});

export const settings: ModuleSettings = {
  schema,
  defaults: { refreshMinutes: '60', keywords: '', muted: '' },
  fields: [
    {
      key: 'refreshMinutes',
      label: 'Feeds abrufen alle',
      type: 'select',
      options: [
        { value: '30', label: '30 Minuten' },
        { value: '60', label: '1 Stunde' },
        { value: '180', label: '3 Stunden' },
      ],
      help: 'Nur solange die App geöffnet ist.',
    },
    {
      key: 'keywords',
      label: 'Nur Artikel mit diesen Wörtern',
      type: 'text',
      help: 'Kommagetrennt, z. B. Klima, Bahn. Leer = alle Artikel.',
    },
    {
      key: 'muted',
      label: 'Artikel mit diesen Wörtern ausblenden',
      type: 'text',
      help: 'Kommagetrennt, z. B. Gewinnspiel, Promi.',
    },
  ],
};
