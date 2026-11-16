import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

/**
 * Nothing to set in this package: the grant per device lives at the PC (never in synced
 * settings); the receive folder (files) and the notification switch come with later packages.
 */
const schema = z.object({});

export const settings: ModuleSettings = {
  schema,
  defaults: {},
  fields: [],
};
