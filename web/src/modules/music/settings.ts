import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

/** The music module has no settings of its own: the connection and its features belong to Einstellungen → Verbindungen (Spotify). */
export const settings: ModuleSettings = {
  schema: z.object({}),
  defaults: {},
  fields: [],
};
