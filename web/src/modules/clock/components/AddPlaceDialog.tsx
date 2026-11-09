import { useMemo, useState } from 'react';
import { useLang } from '@/core/i18n/lang';
import { searchPlaces, type PlaceHit } from '@/core/time/placeSearch';
import { useMinuteNow } from '@/core/time/useMinuteNow';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Dialog, TextField } from '@/ui';
import { addPlace } from '../repo';
import { formatZoneTime } from '../view';
import styles from '../clock.module.css';

/**
 * "Ort hinzufügen": type a city or a zone, pick a hit, done. Offline (`core/time/placeSearch`); the place starts with
 * the city's name, renaming comes after (⋯ → Umbenennen).
 */
export function AddPlaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lang = useLang();
  const at = useMinuteNow();
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchPlaces(query, lang, 8), [query, lang]);
  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = async (hit: PlaceHit) => {
    await addPlace(hit.name, hit.zone);
    useUiStore.getState().toast(t.clock.added(hit.name));
    close();
  };

  return (
    <Dialog open={open} onClose={close} title={t.clock.search.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[0]) void pick(hits[0]);
        }}
      >
        <TextField
          label={t.clock.search.label}
          placeholder={t.clock.search.placeholder}
          hint={t.clock.search.hint}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          data-autofocus
          data-testid="clock-search"
        />
      </form>
      {query.trim() && hits.length === 0 ? (
        <p className={styles.note} role="status">
          {t.clock.search.none}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className={styles.hits} aria-label={t.clock.search.results}>
          {hits.map((h) => (
            <li key={`${h.zone}|${h.name}`}>
              <button
                type="button"
                className={styles.hit}
                onClick={() => void pick(h)}
                data-testid="clock-hit"
              >
                <span className={styles.hitName}>{h.name}</span>
                <span className={styles.hitZone}>{h.zone}</span>
                <span className={styles.hitTime}>{formatZoneTime(at, h.zone)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
}
