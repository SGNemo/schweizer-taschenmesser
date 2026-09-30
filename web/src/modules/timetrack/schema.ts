import { z } from 'zod';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const projectSchema = z.object({
  name: z.string().min(1),
  archived: z.boolean().default(false),
});

/**
 * One block of time. A running timer is an entry with `startedAt` (epoch ms, a technical
 * timestamp) and 0 minutes; stopping it stores the minutes and clears `startedAt`.
 */
export const entrySchema = z.object({
  projectId: z.string().min(1),
  /** Day the work started, 'YYYY-MM-DD' (local). */
  date: z.string().regex(DATE),
  minutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  note: z.string().optional(),
  startedAt: z.number().int().nullable().optional(),
});

export type Project = z.output<typeof projectSchema>;
export type Entry = z.output<typeof entrySchema>;
