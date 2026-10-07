import { z } from 'zod';
import { getSettings, useSettings } from '@/core/settings/settings';

/** Synced with the other settings (Settings → KI). */
export const aiWriteSchema = z.object({
  /** Global switch: off = the assistant only reads. */
  enabled: z.boolean().default(true),
  /** Modules excluded from AI writes. */
  modulesOff: z.array(z.string()).default([]),
  /**
   * Allow the cloud as the last stage for writes. Unset = automatic: on, unless a local model is
   * active (then the free stages come first and the cloud is only used when the user says so).
   */
  cloud: z.boolean().optional(),
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

/** The effective choice: the user's, else "on only while no local model is active". */
export const cloudAllowed = (settings: { cloud?: boolean }, localActive: boolean): boolean =>
  settings.cloud ?? !localActive;
