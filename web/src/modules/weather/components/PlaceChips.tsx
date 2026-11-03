import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { requireNotice } from '@/core/legal/notices';
import { searchPlaces, type Place } from '@/core/weather/api';
import {
  addExtraPlace,
  MAX_EXTRA_PLACES,
  removeExtraPlace,
  useWeatherSettings,
} from '@/core/weather/settings';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Dialog, Icon, IconButton, TextField } from '@/ui';
import styles from '../routes/weather.module.css';

/**
 * The places of the page as chips (the first is the main place from the settings): a tap shows that place, "+ Ort" opens a short
 * search dialog (a short task, so a dialog is right), a small × takes an extra place away again. Three places at most.
 */
export function PlaceChips({ index, places }: { index: number; places: string[] }) {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const [settings] = useWeatherSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | undefined>();
  const [status, setStatus] = useState<'idle' | 'busy' | 'none' | 'down' | 'dup'>('idle');
  const full = (settings?.extra.length ?? 0) >= MAX_EXTRA_PLACES;

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    await requireNotice('weather');
    setStatus('busy');
    try {
      const found = await searchPlaces(query);
      setResults(found);
      setStatus(found.length === 0 ? 'none' : 'idle');
    } catch {
      setResults(undefined);
      setStatus('down');
    }
  }
  async function pick(p: Place) {
    const added = await addExtraPlace(p.label, p.lat, p.lon);
    if (added) {
      setOpen(false);
      setQuery('');
      setResults(undefined);
      setStatus('idle');
    } else setStatus('dup');
  }

  return (
    <>
      <nav className={styles.places} aria-label={tp.placesLabel}>
        {places.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className={styles.placeChip}
            data-on={i === index ? 'true' : undefined}
          >
            <Link
              to={i === 0 ? '?' : `?place=${i}`}
              replace
              aria-current={i === index ? 'true' : undefined}
            >
              {name.split(',')[0]}
            </Link>
            {i > 0 ? (
              <IconButton
                label={tp.removePlace(name.split(',')[0]!)}
                onClick={() => void removeExtraPlace(i - 1)}
              >
                <Icon name="close" size={14} />
              </IconButton>
            ) : null}
          </span>
        ))}
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          disabled={full}
          title={full ? tp.addPlaceFull : undefined}
          data-testid="weather-add-place"
        >
          <Icon name="plus" size={16} />
          {tp.addPlace}
        </Button>
      </nav>
      <Dialog open={open} onClose={() => setOpen(false)} title={tp.addPlace} size="default">
        <form onSubmit={(e) => void search(e)}>
          <TextField
            label={tx.search}
            hint={tx.searchHint}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-autofocus
          />
          <Button type="submit" disabled={status === 'busy'}>
            {status === 'busy' ? tx.searching : tx.searchButton}
          </Button>
        </form>
        {status === 'none' ? <p role="status">{tx.noResults}</p> : null}
        {status === 'down' ? <p role="status">{tx.unavailable}</p> : null}
        {status === 'dup' ? <p role="status">{tp.placeNotAdded}</p> : null}
        {results && results.length > 0 ? (
          <ul aria-label={tx.search} data-testid="weather-extra-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <Button onClick={() => void pick(r)} aria-label={tx.pick(r.label)}>
                  {r.label}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>
    </>
  );
}
