import { dateTimeFormat, formatNumber } from '@/core/i18n/format';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import type { Connection, Leg } from '../transit';
import styles from '../routes/maps.module.css';

export interface Trip {
  name: string;
  status: 'busy' | 'ok' | 'none' | 'blocked' | 'error';
  options?: Connection[];
  index: number;
}

const clock = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(d);
};
const minutes = (seconds: number): string =>
  `${formatNumber(Math.max(1, Math.round(seconds / 60)))} ${t.maps.plan.minutes}`;

function legText(l: Leg): string {
  const k = t.maps.transit.kinds[l.kind];
  const label = l.kind === 'walk' ? k : [k, l.line].filter(Boolean).join(' ');
  return l.kind === 'walk' || !l.headsign ? label : `${label} → ${l.headsign}`;
}

/** The connections found for a public transport route: a short list to choose from, the steps of the chosen one. */
export function TransitCard({
  trip,
  onPick,
  onHide,
}: {
  trip: Trip;
  onPick: (index: number) => void;
  onHide: () => void;
}) {
  const p = t.maps.transit;
  const message =
    trip.status === 'busy'
      ? p.busy
      : trip.status === 'none'
        ? p.none
        : trip.status === 'blocked'
          ? p.blocked
          : trip.status === 'error'
            ? p.unreachable
            : undefined;
  const chosen = trip.options?.[trip.index];
  return (
    <section
      className={styles.card}
      data-testid="map-transit"
      aria-label={trip.name}
      aria-live="polite"
    >
      <p className={styles.cardTitle}>{trip.name}</p>
      <p className={styles.note}>{p.title}</p>
      {message ? <p className={styles.note}>{message}</p> : null}
      {trip.status === 'none' || trip.status === 'error' ? (
        <p className={styles.note}>{p.fallback}</p>
      ) : null}
      {trip.options ? (
        <ul className={styles.hits} aria-label={p.pick} data-testid="map-transit-options">
          {trip.options.map((c, i) => (
            <li key={`${c.start}-${i}`}>
              <button
                type="button"
                className={styles.hit}
                aria-pressed={i === trip.index}
                onClick={() => onPick(i)}
              >
                <Icon name="train" size={18} />
                <span>
                  {clock(c.start)} → {clock(c.end)} · {minutes(c.duration)} ·{' '}
                  {p.changes(c.transfers)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {chosen ? (
        <ol className={styles.steps} data-testid="map-transit-steps">
          {chosen.legs.map((l, i) => (
            <li key={i}>
              {l.kind === 'walk'
                ? `${legText(l)} · ${minutes((Date.parse(l.end) - Date.parse(l.start)) / 1000)}`
                : `${clock(l.start)} ${l.from.name} · ${legText(l)} · ${clock(l.end)} ${l.to.name}`}
            </li>
          ))}
        </ol>
      ) : null}
      {trip.options ? <p className={styles.note}>{p.attribution}</p> : null}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onHide}>
          {p.hide}
        </Button>
      </div>
    </section>
  );
}
