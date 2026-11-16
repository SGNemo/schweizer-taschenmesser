import { now } from '@/core/time/now';
import type { ExchangeKind } from '@/core/platform/types';
import type { ExchangeRow } from './schema';

/** Cards are kept this long (fixed in v1); files on disk are never touched by it. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** The most a body may carry (UTF-8 bytes), as the shell's `MAX_BODY`. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Invisible format characters the shell refuses in an address (bidi, zero-width, BOM, soft hyphen). */
const FORMAT =
  /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]/;

/**
 * A plain `http(s)` address is a link, by the same rules as the shell's `Item::new`: no whitespace,
 * control or format characters, an authority that starts with a letter, digit or `[` and has no
 * `@` or backslash. Everything else is text.
 */
export function kindOf(text: string): ExchangeKind {
  const s = text.trim();
  const m = /^https?:\/\/([^/?#]*)/i.exec(s);
  if (!m || /[\s\p{Cc}]/u.test(s) || FORMAT.test(s)) return 'text';
  const authority = m[1] ?? '';
  return /^[\p{L}\p{N}[]/u.test(authority) && !/[@\\]/.test(authority) ? 'link' : 'text';
}

/**
 * The text that goes out: links trimmed; text with LF line breaks and tabs, without other control
 * characters (the shell refuses them) and without trailing space.
 */
export function bodyOf(text: string, kind: ExchangeKind): string {
  if (kind === 'link') return text.trim();
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\P{Cc}\n\t]/gu, '')
    .replace(/\s+$/, '');
}

/** Whether a body fits the shell's size limit (bytes, not characters: „ä“ and emoji count more). */
export function fits(body: string): boolean {
  return body.trim().length > 0 && new TextEncoder().encode(body).length <= MAX_BODY_BYTES;
}

/** 32 random hex digits (the id both devices know the item by). */
export function newItemId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Only `http(s)` opens; everything else is copy only. */
export function openable(row: Pick<ExchangeRow, 'kind' | 'body'>): boolean {
  return row.kind === 'link' && /^https?:\/\//i.test(row.body);
}

/** The host of a link, shown on its card (parsed here, nothing is fetched). */
export function hostOf(link: string): string {
  try {
    return new URL(link).host;
  } catch {
    return link;
  }
}

/** A removed card can be brought back this long (the undo toast); then it is really deleted. */
export const UNDO_KEEP_MS = 24 * 60 * 60 * 1000;

/** Cards older than the retention, for the sweep (`createdAt` in ms). */
export function expired(createdAt: number, at = now()): boolean {
  return Number.isFinite(createdAt) && at - createdAt > RETENTION_MS;
}

/** Why a phone's session was refused or ended, as the key of its sentence. */
export type PhoneProblem =
  'notPaired' | 'unreachable' | 'exchangeOff' | 'notGranted' | 'paused' | 'limit';

/** The error code of `open` (or the reason of `closed`) as a problem; `null` = nothing to say. */
export function problemOf(
  code: string | null,
  given?: number | null,
): { problem: PhoneProblem; minutes?: number } | null {
  if (!code) return null;
  if (code.startsWith('limit')) {
    // `open` says `limit:<minutes>`; a session's `closed` event carries them separately
    const minutes = given ?? Number(code.split(':')[1]);
    return { problem: 'limit', minutes: Number.isFinite(minutes) ? minutes : undefined };
  }
  switch (code) {
    case 'not-paired':
      return { problem: 'notPaired' };
    case 'exchange-off':
      return { problem: 'exchangeOff' };
    case 'not-granted':
      return { problem: 'notGranted' };
    case 'paused':
      return { problem: 'paused' };
    default:
      // network, no-answer, unknown-device (also "not at home"), closed: the calm waiting state
      return { problem: 'unreachable' };
  }
}
