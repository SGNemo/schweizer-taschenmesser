import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

/** No settings: a routine carries everything it needs. */
export const settings: ModuleSettings = { schema: z.object({}), defaults: {}, fields: [] };
