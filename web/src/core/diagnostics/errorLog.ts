/**
 * A small in-memory error log for the diagnostics export (Settings → Über Nemo). It lives only
 * for the current session, keeps the last 50 entries and stores no stack traces and no data: every
 * message is shortened and stripped of anything that could identify a person or a secret.
 */
import { now } from '@/core/time/now';

export interface LogEntry {
  /** Epoch ms (a technical timestamp). */
  at: number;
  /** Where it came from: a `[tag]` of the app, `window` or `promise`. */
  source: string;
  message: string;
}

export const MAX_ENTRIES = 50;
export const MAX_MESSAGE = 300;

const entries: LogEntry[] = [];

/** Shortens a message and removes URLs (kept: origin), long token-like runs, e-mail addresses and user paths. */
export function sanitize(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"'<>)]+/g, (url) => {
      try {
        return new URL(url).origin;
      } catch {
        return '[url]';
      }
    })
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[mail]')
    .replace(/[A-Za-z]:\\[^\s"']*/g, '[path]')
    .replace(/\/(home|Users)\/[^\s/"']+(\/[^\s"']*)?/g, '/$1/[user]')
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, '[…]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE);
}

const describe = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : typeof e === 'string' ? e : 'unknown error';

export function recordError(source: string, error: unknown): void {
  entries.push({
    at: now(),
    source: sanitize(source).slice(0, 40),
    message: sanitize(describe(error)),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

export const errorLog = (): readonly LogEntry[] => entries.slice();
export const clearErrorLog = (): void => void entries.splice(0, entries.length);

/**
 * Collects uncaught errors, unhandled rejections and the app's own `console.error('[tag] …')` calls.
 * Returns an uninstall function (tests).
 */
export function installErrorLog(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  consoleRef: Pick<Console, 'error'> = console,
): () => void {
  const onError = (e: Event) =>
    recordError('window', (e as ErrorEvent).error ?? (e as ErrorEvent).message);
  const onRejection = (e: Event) => recordError('promise', (e as PromiseRejectionEvent).reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  const original = consoleRef.error;
  consoleRef.error = (...args: unknown[]) => {
    original.apply(consoleRef, args);
    const [first, ...rest] = args;
    const tag = typeof first === 'string' ? /^\[([\w-]+)\]\s*(.*)$/.exec(first) : null;
    if (tag) recordError(tag[1]!, [tag[2], ...rest.map(describe)].filter(Boolean).join(' '));
  };
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    consoleRef.error = original;
  };
}
