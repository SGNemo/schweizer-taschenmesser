import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  soonDays: z.number().int().min(0).max(60),
  remindDaysBefore: z.number().int().min(0).max(30),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { soonDays: 3, remindDaysBefore: 1, remindTime: '18:00' },
  fields: [
    { key: 'soonDays', label: 'Als „läuft bald ab“ zeigen ab (Tage vorher)', type: 'number' },
    { key: 'remindDaysBefore', label: 'Erinnerung vor Ablauf (Tage)', type: 'number' },
    { key: 'remindTime', label: 'Uhrzeit der Erinnerung', type: 'text', help: 'Format HH:mm' },
  ],
};
