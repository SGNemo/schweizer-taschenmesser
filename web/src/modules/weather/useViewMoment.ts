import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { isNowMoment, momentParams, parseMoment, type ViewMoment } from './dayView';

/** History state of the one entry pushed when leaving "now" (CONCEPT-DAYS §3: Back returns to now with one press). */
const PUSHED = 'weatherMoment';

export interface ViewMomentState {
  moment: ViewMoment;
  isNow: boolean;
  /** Show another moment: leaving now pushes one history entry, every further step replaces it. */
  show: (m: ViewMoment) => void;
  /** One offered day back (-1) or on (+1), from the moment last asked for (a quick second press counts). */
  step: (dir: -1 | 1) => void;
}

/**
 * The view moment of the weather page in the address (`day`, `hour`; CONCEPT-DAYS §1, §3): never stored, never
 * synced. A day outside the offered ones or a broken value falls back to now and is removed (`replace`). Returning to
 * now goes back through the entry pushed when leaving it, so the history keeps one entry for all the stepping.
 */
export function useViewMoment(
  /** The place's date today; `undefined` while there is no forecast (nothing is validated or rewritten yet). */
  today: string | undefined,
  /** The days the page offers (today … today + 6, as far as cached). */
  offered: readonly string[],
): ViewMomentState {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const day = params.get('day');
  const hour = params.get('hour');
  const ready = !!today && offered.length > 0;
  const parsed = ready
    ? parseMoment(day, hour, offered, today)
    : { moment: { date: today ?? '', hour: null }, clean: true };
  const pushed = (location.state as Record<string, unknown> | null)?.[PUSHED] === true;
  // The moment asked for but not rendered yet: a second press before the page has followed the address builds on it.
  const pending = useRef<{ moment: ViewMoment; pushed: boolean } | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [day, hour, location.key]);

  const write = useCallback(
    (m: ViewMoment, opts: { push: boolean; pushed?: boolean }) => {
      if (!today) return;
      const next = new URLSearchParams(params);
      next.delete('day');
      next.delete('hour');
      const p = momentParams(m, today);
      if (p.day) next.set('day', p.day);
      if (p.hour) next.set('hour', p.hour);
      setParams(next, {
        replace: !opts.push,
        state:
          opts.push || opts.pushed
            ? { [PUSHED]: true }
            : isNowMoment(m, today)
              ? null
              : location.state,
        preventScrollReset: true,
      });
    },
    [today, params, setParams, location.state],
  );

  const cleanKey = parsed.clean ? '' : `${day}|${hour}`;
  useEffect(() => {
    if (cleanKey) write(parsed.moment, { push: false });
    // Only a new broken address is cleaned; `parsed.moment` follows from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanKey]);

  const isNow = !today || isNowMoment(parsed.moment, today);
  const show = useCallback(
    (m: ViewMoment) => {
      if (!today) return;
      const cur = pending.current ?? { moment: parsed.moment, pushed };
      const curNow = isNowMoment(cur.moment, today);
      if (isNowMoment(m, today)) {
        if (curNow) return;
        pending.current = { moment: m, pushed: false };
        // Back through the pushed entry: the history is as it was before the first step.
        if (cur.pushed) navigate(-1);
        else write(m, { push: false });
        return;
      }
      pending.current = { moment: m, pushed: curNow || cur.pushed };
      write(m, { push: curNow, pushed: cur.pushed });
    },
    // `parsed.moment` follows `day` and `hour`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, day, hour, pushed, navigate, write],
  );
  const step = useCallback(
    (dir: -1 | 1) => {
      const from = (pending.current?.moment ?? parsed.moment).date;
      const to = offered[offered.indexOf(from) + dir];
      if (to) show({ date: to, hour: null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offered, show, day, hour],
  );

  return { moment: parsed.moment, isNow, show, step };
}
