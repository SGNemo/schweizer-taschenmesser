import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';

const RATE_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'dailyLimitExceeded',
]);

export interface GoogleResponse {
  status: number;
  json: unknown;
  headers: Headers;
}

/**
 * GET against a Google API with the user's access token. Maps failures to `ConnectorError` codes
 * (no response text is kept beyond a redacted reason). Statuses in `allow` are returned to the caller.
 */
export async function googleGet(
  ctx: ConnectorContext,
  url: string,
  params: Record<string, string | string[] | undefined> = {},
  allow: number[] = [],
): Promise<GoogleResponse> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) target.searchParams.append(key, v);
  }
  const token = await ctx.accessToken();
  let res: Response;
  try {
    res = await ctx.fetch(target.toString(), { headers: { authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new ConnectorError('network', ctx.redact(String(e)));
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Error pages without JSON are handled by the status below.
  }
  if (res.ok || allow.includes(res.status))
    return { status: res.status, json, headers: res.headers };

  const reason = (json as { error?: { errors?: { reason?: string }[]; status?: string } } | null)
    ?.error;
  const detail = reason?.errors?.[0]?.reason ?? reason?.status ?? `http ${res.status}`;
  if (res.status === 401) throw new ConnectorError('expired', detail);
  if (res.status === 429 || (res.status === 403 && RATE_REASONS.has(detail)))
    throw new ConnectorError(
      'rate-limited',
      detail,
      Number(res.headers.get('retry-after')) || undefined,
    );
  if (res.status === 403) throw new ConnectorError('denied', ctx.redact(detail));
  if (res.status >= 500) throw new ConnectorError('network', `http ${res.status}`);
  throw new ConnectorError('bad-response', ctx.redact(detail));
}
