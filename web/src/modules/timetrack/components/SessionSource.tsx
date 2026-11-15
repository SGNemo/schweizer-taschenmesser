import { Link } from 'react-router';
import { refKey, refOfKey } from '@/core/entitylinks/types';
import { useResolvedLinks } from '@/core/modules/contributions';
import type { LinkState } from '@/core/modules/types';
import { t } from '@/strings';
import styles from '../timetrack.module.css';

const NONE: never[] = [];

/**
 * What a session was started for (`ref`, TT1), read through that module's own link target: its title of today and
 * its route. `undefined` while loading, for a session without `ref`, and for a thing that is gone or not on this
 * device – then nothing is shown (the session keeps its own text in `from` and `note`).
 */
export function useSessionSource(
  ref: string | undefined,
): Extract<LinkState, { state: 'alive' }> | undefined {
  const target = refOfKey(ref);
  const states = useResolvedLinks(target ? [target] : NONE);
  if (!target || !states) return undefined;
  const state = states.get(refKey(target));
  return state?.state === 'alive' ? state : undefined;
}

/** „Für: Zahnarzt“ – the title opens the thing; `onLeave` runs first (the dialog closes). */
export function SessionSourceLink({
  source,
  onLeave,
}: {
  source: { title: string; to: string };
  onLeave?: () => void;
}) {
  return (
    <Link
      to={source.to}
      onClick={onLeave}
      aria-label={t.timetrack.source.open(source.title)}
      data-testid="session-source"
    >
      {source.title}
    </Link>
  );
}

/** The line in the session editor: „Für: <title>“, only while the thing is there. */
export function SessionSourceLine({
  sourceRef,
  onLeave,
}: {
  sourceRef?: string;
  onLeave?: () => void;
}) {
  const source = useSessionSource(sourceRef);
  if (!source) return null;
  return (
    <p className={styles.meta}>
      {t.timetrack.source.label}: <SessionSourceLink source={source} onLeave={onLeave} />
    </p>
  );
}
