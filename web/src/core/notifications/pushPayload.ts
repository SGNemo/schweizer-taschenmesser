/** Shared by the app (which builds payloads) and the service worker (which shows them). */

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

/** Binds an encrypted payload to its notification key so payloads cannot be swapped. */
export const pushAad = (key: string): string => `push/${key}`;

/** Shown when a payload cannot be read (e.g. no key on this device). */
export const FALLBACK_PAYLOAD: PushPayload = {
  title: 'Taschenmesser',
  body: 'Erinnerung',
  url: '/',
};

export interface PushMessage {
  v: 1;
  key: string;
  payload: string;
}

export function parsePushMessage(text: string): PushMessage | undefined {
  try {
    const m = JSON.parse(text) as Partial<PushMessage>;
    return m.v === 1 && typeof m.key === 'string' && typeof m.payload === 'string'
      ? (m as PushMessage)
      : undefined;
  } catch {
    return undefined;
  }
}

export function asPayload(value: unknown): PushPayload | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string' || !v.title) return undefined;
  return {
    title: v.title,
    body: typeof v.body === 'string' ? v.body : undefined,
    url: typeof v.url === 'string' && v.url.startsWith('/') ? v.url : undefined,
  };
}
