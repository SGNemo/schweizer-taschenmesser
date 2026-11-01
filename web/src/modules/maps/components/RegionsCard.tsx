import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { t } from '@/strings';
import { Button } from '@/ui';
import { formatBuiltAt, formatBytes } from '../own/format';
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
  if (region.status === 'done') {
    const parts = [o.done(total), formatBytes(region.bytes)];
    if (region.builtAt) parts.push(o.asOf(formatBuiltAt(region.builtAt)));
    if (region.credit) parts.push(region.credit);
    return parts.join(' · ');
  }
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
  onUpgrade,
  onRemoveAll,
}: {
  regions: readonly Stored<Region>[];
  active?: string;
  phase?: 'cells' | 'overview';
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  /** A finished lean region can be built again in detail. */
  onUpgrade: (id: string) => void;
  onRemoveAll: () => void;
}) {
  const ALL = '*';
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
                {r.source === 'file' ? `${o.fromFile} · ` : ''}
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
                  {r.status === 'done' && r.level === 'lean' && r.source !== 'file' ? (
                    <Button onClick={() => onUpgrade(r.id)}>{o.upgrade}</Button>
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
      {regions.length > 1 ? (
        <div className={styles.actions}>
          {confirming === ALL ? (
            <>
              <span className={styles.meta}>{o.confirmRemoveAll}</span>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirming(undefined);
                  onRemoveAll();
                }}
              >
                {o.removeAll}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(undefined)}>
                {o.keep}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(ALL)}>
              {o.removeAll}
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
