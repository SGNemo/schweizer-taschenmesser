import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { getLang } from '@/core/i18n/lang';
import { t } from '@/strings';
import { Button, SelectField, TextField } from '@/ui';
import { searchPlaces, type Hit } from '../geocode';
import type { Endpoint, Place } from '../schema';

/**
 * One end of a route: pick a saved place, or search for one (the search runs when you press the button,
 * never per key). The choice is shown as text and copied into the route.
 */
export function EndpointPicker({
  label,
  value,
  places,
  onChange,
  searchUrl,
  onSearch,
}: {
  label: string;
  value: Endpoint | undefined;
  places: readonly Stored<Place>[];
  onChange: (value: Endpoint) => void;
  searchUrl: string;
  /** Called before the first search (one-time notice); resolves when the search may go out. */
  onSearch: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>();
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  async function run() {
    if (query.trim().length < 2) return;
    setState('busy');
    try {
      await onSearch();
      setHits(await searchPlaces(query, { baseUrl: searchUrl, lang: getLang().split('-')[0]! }));
      setState('idle');
    } catch {
      setHits(undefined);
      setState('error');
    }
  }

  return (
    <fieldset
      style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}
      data-testid={`endpoint-${label}`}
    >
      <legend style={{ fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {label}
      </legend>
      {value ? <p style={{ margin: 0 }}>{t.maps.route.chosen(value.label)}</p> : null}
      {places.length > 0 ? (
        <SelectField
          label={t.maps.route.pick}
          value=""
          onChange={(e) => {
            const p = places.find((x) => x.id === e.target.value);
            if (p) onChange({ label: p.name, lat: p.lat, lon: p.lon });
          }}
        >
          <option value="">{t.maps.route.pickNone}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextField
            label={t.maps.route.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void run();
              }
            }}
            autoComplete="off"
          />
        </div>
        <Button onClick={() => void run()} disabled={query.trim().length < 2 || state === 'busy'}>
          {state === 'busy' ? t.maps.map.searching : t.maps.route.searchButton}
        </Button>
      </div>
      {state === 'error' ? <p style={{ margin: 0 }}>{t.maps.map.unreachable}</p> : null}
      {hits && hits.length === 0 ? <p style={{ margin: 0 }}>{t.maps.map.noResults}</p> : null}
      {hits && hits.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon},${h.label}`}>
              <button
                type="button"
                style={{
                  minHeight: 'var(--touch)',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 0,
                  color: 'var(--text)',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  onChange({
                    label: h.label.split(',').slice(0, 2).join(',').trim(),
                    lat: h.lat,
                    lon: h.lon,
                  });
                  setHits(undefined);
                  setQuery('');
                }}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
