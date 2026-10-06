/**
 * A small ring buffer for the diagnostics export (Settings → Über Nemo): the last 50 errors (with a
 * shortened stack) and the last 200 tagged log lines. Errors are also kept in a small
 * `localStorage` entry so a crash can still be reported after the restart. It holds no user data:
 * every text is shortened and stripped of anything that could identify a person or a secret.
 * Nothing is sent anywhere; the user decides whether to export it.
 */
import { now } from '@/core/time/now';

export interface LogEntry {
  /** Epoch ms (a technical timestamp). */
  at: number;
  /** Where it came from: a `[tag]` of the app, `window` or `promise`. */
  source: string;
  message: string;
  /** Shortened stack frames (no file names or URLs, paths anonymised); only for errors. */
  stack?: string;
}

export interface LogLine {
  at: number;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export const MAX_ENTRIES = 50;
export const MAX_MESSAGE = 300;
export const MAX_LINES = 200;
export const MAX_STACK_FRAMES = 8;
export const MAX_FRAME = 120;
const STORE_KEY = 'tm-diag-errors';

const entries: LogEntry[] = [];
const lines: LogLine[] = [];

/** Removes URLs (kept: origin), IP addresses, long token-like runs, e-mail addresses and user paths. */
export function scrub(text: string): string {
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
    .replace(/\/(home|Users|root)\/[^\s/"']+(\/[^\s"']*)?/g, '/$1/[user]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\b(?:[0-9a-fA-F]{1,4}:){3,7}[0-9a-fA-F]{1,4}\b/g, '[ip]')
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, '[…]');
}

/** `scrub` for one short message: single line, at most `MAX_MESSAGE` characters. */
export function sanitize(text: string): string {
  return scrub(text).replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE);
}

const describe = (e: unknown): string =>
  e instanceof Error ? `${e.name}: ${e.message}` : typeof e === 'string' ? e : 'unknown error';

/** The first stack frames only, each shortened and anonymised; the message line is dropped. */
export function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const frames = stack
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^at\s|@/.test(l))
    .slice(0, MAX_STACK_FRAMES)
    .map((l) => sanitize(l).slice(0, MAX_FRAME));
  return frames.length ? frames.join('\n') : undefined;
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable or full: the in-memory buffer still works
  }
}

/** Errors of earlier sessions, read once at start. Anything that does not look like an entry is dropped. */
export function loadPersistedErrors(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return;
    const ok = raw.filter(
      (e): e is LogEntry =>
        !!e &&
        typeof e.at === 'number' &&
        typeof e.source === 'string' &&
        typeof e.message === 'string',
    );
    entries.splice(
      0,
      entries.length,
      ...ok.slice(-MAX_ENTRIES).map((e) => ({
        at: e.at,
        source: sanitize(e.source).slice(0, 40),
        message: sanitize(e.message),
        ...(typeof e.stack === 'string' ? { stack: sanitizeStack(e.stack) } : {}),
      })),
    );
  } catch {
    // corrupt entry: start empty
  }
}

export function recordError(source: string, error: unknown): void {
  const stack = error instanceof Error ? sanitizeStack(error.stack) : undefined;
  entries.push({
    at: now(),
    source: sanitize(source).slice(0, 40),
    message: sanitize(describe(error)),
    ...(stack ? { stack } : {}),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  persist();
}

export function logLine(level: LogLine['level'], source: string, message: string): void {
  lines.push({
    at: now(),
    level,
    source: sanitize(source).slice(0, 40),
    message: sanitize(message),
  });
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

export const errorLog = (): readonly LogEntry[] => entries.slice();
export const logLines = (): readonly LogLine[] => lines.slice();
export function clearErrorLog(): void {
  entries.splice(0, entries.length);
  lines.splice(0, lines.length);
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Collects uncaught errors, unhandled rejections and the app's own `console.error('[tag] …')` calls.
 * Returns an uninstall function (tests).
 */
export function installErrorLog(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  consoleRef: Pick<Console, 'error'> & Partial<Pick<Console, 'warn'>> = console,
): () => void {
  loadPersistedErrors();
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
    if (!tag) return;
    const text = [tag[2], ...rest.map(describe)].filter(Boolean).join(' ');
    logLine('error', tag[1]!, text);
    recordError(tag[1]!, text);
  };
  const originalWarn = consoleRef.warn;
  if (originalWarn) {
    consoleRef.warn = (...args: unknown[]) => {
      originalWarn.apply(consoleRef, args);
      const [first, ...rest] = args;
      const tag = typeof first === 'string' ? /^\[([\w-]+)\]\s*(.*)$/.exec(first) : null;
      if (tag) logLine('warn', tag[1]!, [tag[2], ...rest.map(describe)].filter(Boolean).join(' '));
    };
  }
  return () => {
    if (originalWarn) consoleRef.warn = originalWarn;
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    consoleRef.error = original;
  };
}
