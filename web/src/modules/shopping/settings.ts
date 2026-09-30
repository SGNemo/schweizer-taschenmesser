import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settings: ModuleSettings = {
  schema: z.object({}),
  defaults: {},
  fields: [],
};
