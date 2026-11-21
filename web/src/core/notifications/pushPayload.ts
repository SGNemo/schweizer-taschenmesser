/** Shared by the app (which builds payloads) and the service worker (which shows them). */

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  /** "Stumm": the service worker shows it without sound. */
  quiet?: true;
}

/** Binds an encrypted payload to its notification key so payloads cannot be swapped. */
export const pushAad = (key: string): string => `push/${key}`;

/**
 * Body shown when a payload cannot be read (e.g. no key on this device). The service worker has no
 * access to the catalogs or the language setting, so it picks by device language from this map:
 * the active languages only (German, English), like the app. Frozen (docs/i18n/FROZEN.md), kept for
 * re-activation: es 'Recordatorio', fr 'Rappel', pt 'Lembrete'.
 */
const FALLBACK_BODY: Record<string, string> = {
  de: 'Erinnerung',
  en: 'Reminder',
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

/**
 * A link inside the app. Judged the way the browser will read it: resolved against a made-up origin it
 * must stay on that origin and its path must not start with two slashes (tab and line-break characters
 * are dropped by the URL parser, so "/<tab>/host" is "//host").
 */
function isAppPath(value: string): boolean {
  if (!value.startsWith('/') || value.includes('\\')) return false;
  try {
    const url = new URL(value, 'https://app.invalid');
    return url.origin === 'https://app.invalid' && !url.pathname.startsWith('//');
  } catch {
    return false;
  }
}

export function asPayload(value: unknown): PushPayload | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string' || !v.title) return undefined;
  return {
    title: v.title,
    body: typeof v.body === 'string' ? v.body : undefined,
    url: typeof v.url === 'string' && isAppPath(v.url) ? v.url : undefined,
    ...(v.quiet === true ? { quiet: true as const } : {}),
  };
}
