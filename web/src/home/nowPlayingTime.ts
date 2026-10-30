import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';

/** m:ss of a number of milliseconds. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The position of the track now: the reading plus what has passed since, once a second while it plays. */
export function useProgress(
  progressMs: number | undefined,
  durationMs: number | undefined,
  playing: boolean,
  readAt: number,
): number | undefined {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!playing || progressMs === undefined) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [playing, progressMs]);
  if (progressMs === undefined) return undefined;
  const elapsed = playing ? Math.max(0, now() - readAt) : 0;
  const pos = progressMs + elapsed;
  return durationMs ? Math.min(pos, durationMs) : pos;
}
