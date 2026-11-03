import { z } from 'zod';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * Time tracking (new in the Planen group; not the retired module of 0.4, whose tables
 * `timetrack_project` / `timetrack_entry` stay gone: these collections have other names).
 *
 * A **session** is one stretch of work: a start (date + time), an end (absent = still running), a
 * break in minutes and a note. It belongs to a **job** ("project", optionally of a **client**) that
 * carries a colour and an hourly rate in cents. Money is integer cents; times are local `HH:mm`.
 */
export const clientSchema = z.object({
  name: z.string().min(1),
  order: z.number().default(0),
});
export type Client = z.output<typeof clientSchema>;

export const jobSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().optional(),
  /** Index into the fixed category palette (`categoryColor`); the name always travels with the colour. */
  tone: z.number().int().min(0).max(5).default(0),
  /** Hourly rate in cents; missing = no amount is shown. */
  rateCents: z.number().int().min(0).max(100_000_00).optional(),
  /** Non-billable jobs count as time but never as an amount. */
  billable: z.boolean().default(true),
  order: z.number().default(0),
  archived: z.boolean().optional(),
});
export type Job = z.output<typeof jobSchema>;

export const sessionSchema = z.object({
  /** Missing = "Ohne Projekt". */
  jobId: z.string().optional(),
  /** Day the session started (a session that runs past midnight stays on this day). */
  date: z.string().regex(DATE_RE),
  startTime: z.string().regex(TIME_RE),
  /** Set when the session ended on another day. */
  endDate: z.string().regex(DATE_RE).optional(),
  /** Absent = running. */
  endTime: z.string().regex(TIME_RE).optional(),
  /** Minutes of break inside the session (also filled by "Pause" while it runs). */
  breakMin: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .default(0),
  /** A running session that is paused right now: since when. */
  pausedDate: z.string().regex(DATE_RE).optional(),
  pausedAt: z.string().regex(TIME_RE).optional(),
  note: z.string().optional(),
  /** Where the session came from ("Zahnarzt" for a start from a calendar event); free text, never a link. */
  from: z.string().optional(),
});
export type Session = z.output<typeof sessionSchema>;
