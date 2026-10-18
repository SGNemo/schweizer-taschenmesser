import { REMINDER_DEFAULT_TIME } from './reminders';

/**
 * A reminder made by the assistant notifies at its time (like one made in the calendar or by quick
 * capture); without a time it gets the usual morning hour, which the preview flags.
 */
export default async function defaults(
  collection: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (collection !== 'event' || data.kind !== 'reminder') return {};
  return {
    allDay: false,
    startTime: REMINDER_DEFAULT_TIME,
    notify: { minutesBefore: 0, enabled: true },
  };
}
