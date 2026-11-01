import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button } from '@/ui';
import type { Region } from '../schema';
import styles from './RegionsCard.module.css';

/** One calm line per region: what it is, how far it got, why it waits; the next step as a button. */
export function regionStatus(
  region: Stored<Region>,
  active: string | undefined,
  phase: 'cells' | 'overview' | undefined,
): string {
  const o = t.maps.own;
  const { done, total } = region.cells;
  if (region.status === 'building') {
    if (active !== region.id) return o.queued;
    return phase === 'overview' ? o.overview : o.building(done, total);
  }
  if (region.status === 'done') return o.done(total);
  const reason = region.reason ? ` · ${o.reasons[region.reason]}` : '';
  return `${o.paused(done, total)}${reason}`;
}

export function RegionsCard({
  regions,
  active,
  phase,
  onPause,
  onResume,
  onRemove,
}: {
  regions: readonly Stored<Region>[];
  active?: string;
  phase?: 'cells' | 'overview';
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState<string>();
  if (regions.length === 0) return null;
  const o = t.maps.own;
  return (
    <section className={styles.card} data-testid="map-regions" aria-label={o.title}>
      <h3 className={styles.title}>{o.title}</h3>
      <ul className={styles.list}>
        {regions.map((r) => (
          <li key={r.id} className={styles.row} data-testid="map-region" data-status={r.status}>
            <div className={styles.text}>
              <p className={styles.name}>{r.name}</p>
              <p className={styles.meta} role="status">
                {o.level[r.level]} · {regionStatus(r, active, phase)}
              </p>
            </div>
            <div className={styles.actions}>
              {confirming === r.id ? (
                <>
                  <span className={styles.meta}>{o.confirmRemove}</span>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setConfirming(undefined);
                      onRemove(r.id);
                    }}
                  >
                    {o.remove}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(undefined)}>
                    {o.keep}
                  </Button>
                </>
              ) : (
                <>
                  {r.status === 'building' ? (
                    <Button onClick={() => onPause(r.id)}>{o.pause}</Button>
                  ) : null}
                  {r.status === 'paused' ? (
                    <Button variant="primary" onClick={() => onResume(r.id)}>
                      {o.resume}
                    </Button>
                  ) : null}
                  {r.status !== 'building' ? (
                    <Button variant="ghost" onClick={() => setConfirming(r.id)}>
                      {o.remove}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
