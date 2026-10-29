/** The ICS addresses the user configured. They are secrets ("secret address in iCal format"). */
import { isPublicHttpsUrl } from '@/core/net/publicUrl';
import type { ConnectorContext } from '@/core/connectors/types';

export interface IcsSubscription {
  id: string;
  name: string;
  url: string;
}

const SECRET = 'subscriptions';

export async function loadSubscriptions(ctx: ConnectorContext): Promise<IcsSubscription[]> {
  const raw = await ctx.secrets.get(SECRET);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (s): s is IcsSubscription =>
            typeof s?.id === 'string' && typeof s?.name === 'string' && typeof s?.url === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export async function saveSubscriptions(
  ctx: ConnectorContext,
  list: IcsSubscription[],
): Promise<void> {
  if (list.length === 0) await ctx.secrets.delete(SECRET);
  else await ctx.secrets.set(SECRET, JSON.stringify(list));
}

/** `webcal://` is an https address in disguise; only public https addresses are accepted (the error text says so). */
export function normalizeIcsUrl(input: string): string | undefined {
  const trimmed = input.trim().replace(/^webcal:\/\//i, 'https://');
  try {
    return isPublicHttpsUrl(trimmed) ? new URL(trimmed).toString() : undefined;
  } catch {
    return undefined;
  }
}
