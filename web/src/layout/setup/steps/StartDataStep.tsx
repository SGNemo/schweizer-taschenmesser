import { useEffect, useState } from 'react';
import { wasOnboardingHandled } from '@/core/importer/batches';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { hasStartData } from '@/core/dataapi/onboarding';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { Badge } from '@/ui';

const s = t.setup.steps.startdata;

/**
 * One row per active module with start data. The existing wizard (preview, duplicates, undo) does
 * the work and is its own explicit action; this step only points to it.
 */
export default function StartDataStep(_props: SetupStepProps) {
  const states = useModuleStates();
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const modules = availableManifests().filter((m) => states?.[m.id] && hasStartData(m));

  useEffect(() => {
    let live = true;
    void Promise.all(
      modules.map(async (m) => [m.id, await wasOnboardingHandled(m.id)] as const),
    ).then((rows) => live && setHandled(Object.fromEntries(rows)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  if (!states) return null;
  if (modules.length === 0) return <p>{s.none}</p>;
  return (
    <ul
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-3)' }}
    >
      {modules.map((m) => (
        <li
          key={m.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <span>
            <strong>{m.name}</strong> {handled[m.id] ? <Badge>{s.handled}</Badge> : null}
            {s.hints[m.id] ? (
              <>
                <br />
                <span style={{ color: 'var(--text-muted)' }}>{s.hints[m.id]}</span>
              </>
            ) : null}
          </span>
          <StartDataButton moduleId={m.id} />
        </li>
      ))}
    </ul>
  );
}
