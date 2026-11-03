import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * Events use local wall-clock date + time strings (not epoch ms): they stay put when the device
 * timezone changes and recurrence works on plain dates.
 */
/** Notify `minutesBefore` the start (0 = at the start); all-day events use the module's notify time. */
export const notifySchema = z.object({
  minutesBefore: z.number().int().min(0).max(10080),
  enabled: z.boolean(),
  /** Further lead times (minutes before the start) that notify as well, e.g. a day before and an hour before. */
  extraMinutes: z.array(z.number().int().min(0).max(10080)).optional(),
});
export type Notify = z.output<typeof notifySchema>;

export const EVENT_KINDS = ['event', 'reminder'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const eventSchema = z
  .object({
    title: z.string().min(1),
    /** A reminder is an event the app notifies about (since 0.7.0, replaces the module "reminders"). Missing = event. */
    kind: z.enum(EVENT_KINDS).optional(),
    allDay: z.boolean().default(false),
    startDate: z.string().regex(DATE_RE),
    startTime: z.string().regex(TIME_RE).optional(),
    /** Last day of a multi-day event (inclusive); absent = same day. */
    endDate: z.string().regex(DATE_RE).optional(),
    endTime: z.string().regex(TIME_RE).optional(),
    location: z.string().optional(),
    note: z.string().optional(),
    /** The person or client the entry is for (People module); only the id, never sent to an AI. */
    personId: z.string().optional().meta({ internal: true }),
    recurrence: recurrenceSchema.optional(),
    /** Occurrence dates (YYYY-MM-DD) of a recurring event that are skipped ("nur diesen Termin löschen"). */
    exdates: z.array(z.string().regex(DATE_RE)).optional(),
    /** Id of the named calendar the event belongs to; missing = none. */
    calendarId: z.string().optional(),
    notify: notifySchema.optional(),
    /** A reminder answered with "Genommen" instead of "Erledigt" (medication, vitamins); nothing is counted. */
    taken: z.boolean().optional(),
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
 * A named calendar of the user ("Arbeit", "Familie"). `tone` is an index into the fixed category
 * palette (`categoryColor`); the name always travels with the colour. An event without `calendarId`
 * belongs to no named calendar and is always shown.
 */
export const calendarSchema = z.object({
  name: z.string().min(1),
  tone: z.number().int().min(0).max(5).default(0),
  /** Switched off = its events are left out of every view (they are not deleted). */
  visible: z.boolean().default(true),
  order: z.number().int().default(0),
});
export type CalendarList = z.output<typeof calendarSchema>;

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
