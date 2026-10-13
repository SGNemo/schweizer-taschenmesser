/** Shared by the app (which builds payloads) and the service worker (which shows them). */

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
}

/** Binds an encrypted payload to its notification key so payloads cannot be swapped. */
export const pushAad = (key: string): string => `push/${key}`;

/**
 * Body shown when a payload cannot be read (e.g. no key on this device). The service worker has no
 * access to the catalogs or the language setting, so it picks by device language from this map.
 */
const FALLBACK_BODY: Record<string, string> = {
  de: 'Erinnerung',
  en: 'Reminder',
  es: 'Recordatorio',
  fr: 'Rappel',
  pt: 'Lembrete',
};

export function fallbackPayload(languages: readonly string[] = []): PushPayload {
  const base = languages
    .map((l) => l.toLowerCase().split('-')[0])
    .find((l) => l && l in FALLBACK_BODY);
  return { title: 'Nemo', body: FALLBACK_BODY[base ?? 'en']!, url: '/' };
}

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
