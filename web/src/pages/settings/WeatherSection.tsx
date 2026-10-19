import { useState, type FormEvent } from 'react';
import { requireNotice } from '@/core/legal/notices';
import { searchPlaces, type Place } from '@/core/weather/api';
import {
  chooseWeatherPlace,
  clearWeatherPlace,
  setWeatherEnabled,
  useWeatherSettings,
} from '@/core/weather/settings';
import { tWeather } from '@/core/weather/strings';
import { Button, Switch, TextField, SettingRow } from '@/ui';
import styles from './settings.module.css';

/** Weather line: the switch, the chosen place and a place search (one request per search, on a click). */
export function WeatherSection() {
  const tx = tWeather.use();
  const [settings] = useWeatherSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | undefined>();
  const [status, setStatus] = useState<'idle' | 'busy' | 'none' | 'down'>('idle');

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

  async function pick(place: Place) {
    await chooseWeatherPlace(place.label, place.lat, place.lon);
    setResults(undefined);
    setQuery('');
    setStatus('idle');
  }

  if (!settings) return null;
  return (
    <>
      <SettingRow id="weather--enabled" label={tx.enable} description={tx.enableHint}>
        <Switch
          label={tx.enable}
          labelHidden
          checked={settings.enabled}
          onChange={(enabled) => void setWeatherEnabled(enabled)}
        />
      </SettingRow>
      <SettingRow id="weather--place" label={tx.placeLabel} description={tx.privacy} stacked>
        <p data-testid="weather-place">{settings.place || tx.placeNone}</p>
        {settings.place ? (
          <Button variant="ghost" onClick={() => void clearWeatherPlace()}>
            {tx.remove}
          </Button>
        ) : null}
        <form onSubmit={(e) => void search(e)} className={styles.inlineForm}>
          <TextField
            label={tx.search}
            hint={tx.searchHint}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" disabled={status === 'busy'}>
            {status === 'busy' ? tx.searching : tx.searchButton}
          </Button>
        </form>
        {status === 'none' ? <p role="status">{tx.noResults}</p> : null}
        {status === 'down' ? <p role="status">{tx.unavailable}</p> : null}
        {results && results.length > 0 ? (
          <ul aria-label={tx.search} data-testid="weather-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <Button onClick={() => void pick(r)} aria-label={tx.pick(r.label)}>
                  {r.label}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </SettingRow>
    </>
  );
}
