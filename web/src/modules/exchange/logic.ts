import { now } from '@/core/time/now';
import type { ExchangeKind } from '@/core/platform/types';
import type { ExchangeRow } from './schema';

/** Cards are kept this long (fixed in v1); files on disk are never touched by it. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** A plain `http(s)` address with a host and nothing else around it is a link; all else is text. */
export function kindOf(text: string): ExchangeKind {
  const s = text.trim();
  return /^https?:\/\/[^\s/@\\?#][^\s@\\]*$/i.test(s) ? 'link' : 'text';
}

/** The text that goes out: links trimmed, text with its line breaks, never empty. */
export function bodyOf(text: string, kind: ExchangeKind): string {
  return kind === 'link' ? text.trim() : text.replace(/\s+$/, '');
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

/** Cards older than the retention, for the sweep. */
export function expired(createdAt: string, at = now()): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && at - t > RETENTION_MS;
}

/** Why a phone's session was refused or ended, as the key of its sentence. */
export type PhoneProblem =
  | 'notPaired'
  | 'unreachable'
  | 'exchangeOff'
  | 'notGranted'
  | 'paused'
  | 'limit';

/** The error code of `open` (or the reason of `closed`) as a problem; `null` = nothing to say. */
export function problemOf(code: string | null): { problem: PhoneProblem; minutes?: number } | null {
  if (!code) return null;
  if (code.startsWith('limit')) {
    const minutes = Number(code.split(':')[1]);
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
