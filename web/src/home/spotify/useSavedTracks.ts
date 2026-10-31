import { useCallback, useEffect, useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import type { NowPlayingHandle } from '../useNowPlaying';

export type SaveProblem = 'reconnect' | 'failed' | undefined;

/**
 * Which of the shown songs are in the user's saved songs ("Lieblingssongs"), and the heart that changes
 * it. The state is asked from Spotify for the visible ids (50 at a time) and kept only while the player is
 * open; a tap on the heart is applied at once and taken back when Spotify says no. Without the
 * "Lieblingssongs" feature nothing is asked and `canSave` is false.
 */
export function useSavedTracks(np: NowPlayingHandle, ids: readonly string[]) {
  const { source, ctx, features } = np;
  const available = features.includes('library') && !!source.saved && !!source.save;
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<SaveProblem>();
  const key = ids.join(',');

  useEffect(() => {
    if (!available) return;
    const unknown = [...new Set(ids)].filter((id) => !(id in map)).slice(0, 50);
    if (unknown.length === 0) return;
    let alive = true;
    source.saved!(ctx, unknown)
      .then((answers) => {
        if (alive)
          setMap((m) => ({
            ...m,
            ...Object.fromEntries(unknown.map((id, i) => [id, answers[i] === true])),
          }));
      })
      .catch(() => {
        // Without the answer the hearts stay empty; nothing else changes.
        if (alive)
          setMap((m) => ({ ...m, ...Object.fromEntries(unknown.map((id) => [id, false])) }));
      });
    return () => {
      alive = false;
    };
    // `map` is read for the unknown ids only; a new answer must not start another request for the same ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, source, ctx, key]);

  const toggle = useCallback(
    async (id: string, on: boolean) => {
      if (!available) return;
      setProblem(undefined);
      setMap((m) => ({ ...m, [id]: on }));
      try {
        await source.save!(ctx, [id], on);
      } catch (e) {
        setMap((m) => ({ ...m, [id]: !on }));
        if (e instanceof ConnectorError && e.code === 'denied') setProblem('reconnect');
        else if (e instanceof ConnectorError && e.code === 'expired')
          await np.run(() => Promise.reject(e));
        else setProblem('failed');
      }
    },
    [available, source, ctx, np],
  );

  return { canSave: available, saved: map, toggle, problem };
}
