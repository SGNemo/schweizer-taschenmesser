import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * Events use local wall-clock date + time strings (not epoch ms): they stay put when the device
 * timezone changes and recurrence works on plain dates.
 */
export const eventSchema = z
  .object({
    title: z.string().min(1),
    allDay: z.boolean().default(false),
    startDate: z.string().regex(DATE_RE),
    startTime: z.string().regex(TIME_RE).optional(),
    /** Last day of a multi-day event (inclusive); absent = same day. */
    endDate: z.string().regex(DATE_RE).optional(),
    endTime: z.string().regex(TIME_RE).optional(),
    location: z.string().optional(),
    note: z.string().optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .refine((e) => !e.endDate || e.endDate >= e.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  })
  .refine(
    (e) =>
      e.allDay ||
      !e.startTime ||
      !e.endTime ||
      (e.endDate ?? e.startDate) > e.startDate ||
      e.endTime >= e.startTime,
    { message: 'endTime must not be before startTime', path: ['endTime'] },
  );

export type CalendarEvent = z.output<typeof eventSchema>;

/**
 * An event copied from an outside calendar (Google, an ICS subscription). Read-only in the UI;
 * `source` + `calendarId` + `extId` identify it in the service, `etag` lets a sync skip unchanged
 * events. The record id is derived from those three, so every device converges on one record.
 */
export const externalEventSchema = z.object({
  /** Connector id: 'google', 'ics'. */
  source: z.string().min(1),
  calendarId: z.string().min(1),
  extId: z.string().min(1),
  etag: z.string().optional(),
  title: z.string().min(1),
  allDay: z.boolean().default(false),
  startDate: z.string().regex(DATE_RE),
  startTime: z.string().regex(TIME_RE).optional(),
  endDate: z.string().regex(DATE_RE).optional(),
  endTime: z.string().regex(TIME_RE).optional(),
  location: z.string().optional(),
  note: z.string().optional(),
  recurrence: recurrenceSchema.optional(),
  /** '#rrggbb' of the source calendar. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  url: z.string().optional(),
  kind: z.enum(['event', 'birthday', 'gmail']).default('event'),
});

export type ExternalEventRecord = z.output<typeof externalEventSchema>;
