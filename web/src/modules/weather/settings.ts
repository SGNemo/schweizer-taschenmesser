import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

/**
 * The weather module has no settings of its own: the place and the switch belong to the shared `weather` scope
 * (Einstellungen → Verbindungen), which also feeds the overview widget. An empty schema keeps the module contract.
 */
export const settings: ModuleSettings = {
  schema: z.object({}),
  defaults: {},
  fields: [],
};
