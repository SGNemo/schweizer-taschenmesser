import { now } from '@/core/time/now';

/**
 * C04 (Erstkontakt-Runde): a phone kills a backgrounded app, and half-typed quick-capture text was
 * gone. The text is kept on this device only (like the notes crash draft, never synced), and only
 * until the sheet closes, the entry is saved, or 30 minutes have passed.
 */
const KEY = 'tm-capture-draft';
const MAX_AGE_MS = 30 * 60_000;

const safe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined; // storage blocked (private mode): the draft simply is not kept
  }
};

export function readCaptureDraft(): string | undefined {
  const raw = safe(() => localStorage.getItem(KEY));
  if (!raw) return undefined;
  const parsed = safe(() => JSON.parse(raw) as { text?: unknown; at?: unknown });
  if (
    !parsed ||
    typeof parsed.text !== 'string' ||
    typeof parsed.at !== 'number' ||
    now() - parsed.at > MAX_AGE_MS
  ) {
    clearCaptureDraft();
    return undefined;
  }
  return parsed.text;
}

export function writeCaptureDraft(text: string): void {
  if (!text.trim()) return clearCaptureDraft();
  safe(() => localStorage.setItem(KEY, JSON.stringify({ text, at: now() })));
}

export function clearCaptureDraft(): void {
  safe(() => localStorage.removeItem(KEY));
}
