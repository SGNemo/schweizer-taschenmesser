/** Only these schemes are opened: they are what the native shell's opener is allowed to launch. */
const SCHEME = /^(https?:|mailto:|tel:)/i;

/** Adds `https://` to a bare address ("dhl.de"); undefined when the result is not a launchable link. */
export function normalizeLaunchUrl(input: string): string | undefined {
  const text = input.trim();
  if (!text || /\s/.test(text)) return undefined;
  const withScheme = SCHEME.test(text)
    ? text
    : /^[a-z][a-z0-9+.-]*:/i.test(text)
      ? ''
      : `https://${text}`;
  if (!withScheme) return undefined;
  try {
    const url = new URL(withScheme);
    if (
      /^https?:$/.test(url.protocol) &&
      (!url.hostname.includes('.') || url.username || url.password)
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export interface LaunchPreset {
  id: string;
  title: string;
  url: string;
  group: string;
}

/**
 * Suggestions for the start-data wizard. Top-level addresses only (they rarely change); the user
 * confirms each one in the preview.
 */
export const PRESETS: readonly LaunchPreset[] = [
  { id: 'dhl', title: 'DHL Sendungsverfolgung', url: 'https://www.dhl.de/', group: 'Pakete' },
  {
    id: 'hermes',
    title: 'Hermes Sendungsverfolgung',
    url: 'https://www.myhermes.de/',
    group: 'Pakete',
  },
  { id: 'dpd', title: 'DPD Sendungsverfolgung', url: 'https://www.dpd.de/', group: 'Pakete' },
  { id: 'bahn', title: 'Deutsche Bahn', url: 'https://www.bahn.de/', group: 'Reisen' },
  { id: 'maps', title: 'Google Maps', url: 'https://www.google.com/maps', group: 'Reisen' },
  { id: 'whatsapp', title: 'WhatsApp Web', url: 'https://web.whatsapp.com/', group: 'Nachrichten' },
  { id: 'spotify', title: 'Spotify', url: 'https://open.spotify.com/', group: 'Musik' },
  { id: 'wetter', title: 'Deutscher Wetterdienst', url: 'https://www.dwd.de/', group: 'Sonstiges' },
];

/** Same address (case, `www.`, trailing slash ignored) = same link. */
export const urlKey = (url: string): string =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');

export interface Grouped<T> {
  group: string;
  items: T[];
}

/** Links grouped by their group name (unnamed ones last), titles sorted within a group. */
export function groupLinks<T extends { title: string; group?: string }>(
  links: readonly T[],
): Grouped<T>[] {
  const map = new Map<string, T[]>();
  for (const l of links) {
    const key = l.group?.trim() ?? '';
    map.set(key, [...(map.get(key) ?? []), l]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de')))
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.title.localeCompare(b.title, 'de')),
    }));
}
