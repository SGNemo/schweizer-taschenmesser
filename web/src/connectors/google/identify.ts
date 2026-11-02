import type { ConnectorContext } from '@/core/connectors/types';
import { googleGet } from './http';

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.includes('@') ? v : undefined;

/**
 * Who is signed in? Uses what the granted scopes already allow – the Gmail profile, else the id of
 * the primary calendar (which is the address) – so no extra scope such as `email` is requested.
 */
export async function googleIdentify(ctx: ConnectorContext): Promise<string | undefined> {
  const profile = await googleGet(
    ctx,
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {},
    [403],
  );
  if (profile.status === 200) {
    const mail = text((profile.json as { emailAddress?: unknown } | null)?.emailAddress);
    if (mail) return mail;
  }
  const calendar = await googleGet(
    ctx,
    'https://www.googleapis.com/calendar/v3/calendars/primary',
    {},
    [403],
  );
  return calendar.status === 200 ? text((calendar.json as { id?: unknown } | null)?.id) : undefined;
}
