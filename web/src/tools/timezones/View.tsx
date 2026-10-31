import { useMemo, useState } from 'react';
import { now } from '@/core/time/now';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, Icon, IconButton, SelectField, TextField } from '@/ui';
import { readStored, writeStored } from '../shared';
import styles from '../tools.module.css';
import { ZONES, isKnownZone, showIn, zoneLabel, zonedInstant } from './logic';

const s = t.tools.timezones;
const KEY = 'tm.tools.timezones';

interface Saved {
  from: string;
  to: string[];
}

function localZone(): string {
  const id = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return id && isKnownZone(id) ? id : 'Europe/Berlin';
}

function load(): Saved {
  const fallback: Saved = { from: localZone(), to: ['UTC', 'America/New_York', 'Asia/Tokyo'] };
  try {
    const v: unknown = JSON.parse(readStored(KEY) ?? 'null');
    if (v && typeof v === 'object') {
      const { from, to } = v as Partial<Saved>;
      if (typeof from === 'string' && isKnownZone(from) && Array.isArray(to)) {
        return {
          from,
          to: to.filter((z): z is string => typeof z === 'string' && isKnownZone(z)).slice(0, 8),
        };
      }
    }
  } catch {
    // Unreadable value: use the defaults.
  }
  return fallback;
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function TimezonesTool() {
  const [saved, setSaved] = useState(load);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => hhmm(now()));
  const [pick, setPick] = useState('');

  const update = (next: Saved) => {
    setSaved(next);
    writeStored(KEY, JSON.stringify(next));
  };

  const instant = zonedInstant(date, time, saved.from);
  const rows = useMemo(
    () =>
      instant === undefined
        ? []
        : saved.to.map((z) => ({ zone: z, ...showIn(instant, z, saved.from) })),
    [instant, saved],
  );
  const free = ZONES.filter((z) => z.id !== saved.from && !saved.to.includes(z.id));
  const here = localZone();

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <div className={styles.grow}>
          <TextField
            label={s.date}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className={styles.grow}>
          <TextField
            label={s.time}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            setDate(today());
            setTime(hhmm(now()));
            update({ ...saved, from: here });
          }}
        >
          {s.now}
        </Button>
      </div>
      <SelectField
        label={s.from}
        value={saved.from}
        onChange={(e) => update({ ...saved, from: e.target.value })}
      >
        {[
          ...ZONES,
          ...(ZONES.some((z) => z.id === saved.from)
            ? []
            : [{ id: saved.from, label: saved.from }]),
        ].map((z) => (
          <option key={z.id} value={z.id}>
            {z.label}
            {z.id === here ? ` (${s.here})` : ''}
          </option>
        ))}
      </SelectField>

      <section aria-label={s.results}>
        {instant === undefined ? (
          <p className={styles.error} role="alert">
            {s.invalid}
          </p>
        ) : (
          <ul className={styles.list} data-testid="zone-results">
            {rows.map((r) => (
              <li key={r.zone} className={styles.item}>
                <span>
                  <strong>{zoneLabel(r.zone)}</strong>
                  <br />
                  <span className={styles.muted}>{r.offset}</span>
                </span>
                <span>
                  <span className={styles.result} data-testid={`zone-time-${r.zone}`}>
                    {r.time}
                  </span>{' '}
                  <span className={styles.muted}>
                    {r.date.split('-').reverse().join('.')} {s.dayDiff(r.dayDiff)}
                  </span>
                  <IconButton
                    label={s.remove(zoneLabel(r.zone))}
                    onClick={() => update({ ...saved, to: saved.to.filter((z) => z !== r.zone) })}
                  >
                    <Icon name="close" size={16} />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {free.length > 0 && saved.to.length < 8 ? (
        <div className={styles.row}>
          <div className={styles.grow}>
            <SelectField label={s.add} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">–</option>
              {free.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </SelectField>
          </div>
          <Button
            disabled={!pick}
            onClick={() => {
              update({ ...saved, to: [...saved.to, pick] });
              setPick('');
            }}
          >
            {s.addButton}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
