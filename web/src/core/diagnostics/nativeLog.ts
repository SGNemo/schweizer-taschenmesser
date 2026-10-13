import { getPlatform } from '@/core/platform';
import { recordEntry } from './errorLog';

/** `<unix seconds> <file>:<line> <message>` as written by the Rust panic hook (`panic_log.rs`). */
const LINE = /^(\d{1,12}) (\S+) (.*)$/;

/**
 * Brings the panics of earlier native runs into the diagnostics buffer, once: the native side
 * hands the file over and deletes it. Anything that does not look like a panic line is ignored.
 */
export async function importNativePanics(platform = getPlatform()): Promise<number> {
  const text = await (platform.desktop.takePanicLog?.() ?? Promise.resolve(null)).catch(() => null);
  if (!text) return 0;
  let n = 0;
  for (const raw of text.split('\n')) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    recordEntry({ at: Number(m[1]) * 1000, source: 'rust', message: `panic at ${m[2]}: ${m[3]}` });
    n++;
  }
  return n;
}
