import { z } from 'zod';
import { getSettings, useSettings } from '@/core/settings/settings';

/** Synced with the other settings (Settings → KI). */
export const aiWriteSchema = z.object({
  /** Global switch: off = the assistant only reads. */
  enabled: z.boolean().default(true),
  /** Modules excluded from AI writes. */
  modulesOff: z.array(z.string()).default([]),
  /** Allow the cloud as the last stage for writes. */
  cloud: z.boolean().default(true),
  /** Ask in the preview when a required field is missing (otherwise such sentences are not proposed). */
  askMissing: z.boolean().default(true),
});

export type AiWriteSettings = z.output<typeof aiWriteSchema>;

export const AI_WRITE_SCOPE = 'ai.write';
export const AI_WRITE_DEFAULTS: z.input<typeof aiWriteSchema> = {};

export const loadAiWriteSettings = (): Promise<AiWriteSettings> =>
  getSettings(AI_WRITE_SCOPE, aiWriteSchema, AI_WRITE_DEFAULTS);

export const useAiWriteSettings = () =>
  useSettings(AI_WRITE_SCOPE, aiWriteSchema, AI_WRITE_DEFAULTS);
