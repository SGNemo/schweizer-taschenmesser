import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { formatNumber } from '@/core/i18n/format';
import { getLang } from '@/core/i18n/lang';
import { requireNotice } from '@/core/legal/notices';
import { getPlatform } from '@/core/platform';
import { useSettings } from '@/core/settings/settings';
import { deleteWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  Segmented,
  TextField,
  useOpenParam,
  type RowMenuItem,
} from '@/ui';
import { PlaceEditor, type PlaceTarget } from '../components/PlaceEditor';
import { RouteEditor, type RouteTarget } from '../components/RouteEditor';
import { TileMap, type MapMarker } from '../components/TileMap';
import { searchPlaces, MapsError, type Hit } from '../geocode';
import { CATEGORY_ICON, MODE_ICON } from '../icons';
import {
  MAP_APPS,
  distanceMeters,
  fitView,
  formatDistance,
  parseCoordinates,
  placeLink,
  roundCoord,
  routeLink,
  type MapApp,
  type View,
} from '../logic';
import { placeRepo, routeRepo } from '../repo';
import { describeStep, fetchPlan, isDrivingMode, splitDuration, type Plan } from '../routing';
import type { Endpoint, Place, Route } from '../schema';
import { servicesOf, settings, DEFAULT_TILE_URL } from '../settings';
import styles from './maps.module.css';

type Tab = 'places' | 'routes' | 'map';
const TABS: readonly Tab[] = ['places', 'routes', 'map'];
const GERMANY: View = { lat: 51.1657, lon: 10.4515, zoom: 5 };

interface Shown {
  route: Stored<Route>;
  status: 'busy' | 'ok' | 'noroute' | 'blocked' | 'error';
  plan?: Plan;
}

interface Selection {
  lat: number;
  lon: number;
  label: string;
  /** Set when the point is a saved place. */
  place?: Stored<Place>;
}

/** "Schlossplatz, Erlangen, Bayern" → "Schlossplatz"; coordinates stay whole. */
const shortLabel = (label: string): string =>
  parseCoordinates(label) ? label : label.split(',')[0]!.trim() || label;

const openUrl = (url: string) => void getPlatform().app.openUrl(url);
const isAndroid = () => getPlatform().kind === 'android';
const apps = (): MapApp[] => MAP_APPS.filter((a) => a !== 'geo' || isAndroid());

const formatTime = (seconds: number): string => {
  const { h, m } = splitDuration(seconds);
  return h > 0
    ? `${h} ${t.maps.plan.hours} ${m} ${t.maps.plan.minutes}`
    : `${m} ${t.maps.plan.minutes}`;
};

function stepText(step: Plan['steps'][number]): string {
  const d = describeStep(step);
  const p = t.maps.plan;
  const onto = d.name ? ` ${p.onto(d.name)}` : '';
  switch (d.kind) {
    case 'depart':
      return `${p.depart}${onto}`;
    case 'arrive':
      return p.arrive;
    case 'roundabout':
      return `${p.roundabout}${onto}`;
    case 'continue':
      return `${p.continue}${onto}`;
    default:
      return `${p.turn[d.direction ?? 'straight']}${onto}`;
  }
}

function PlanCard({ shown, onHide }: { shown: Shown; onHide: () => void }) {
  const { route, status, plan } = shown;
  const p = t.maps.plan;
  const message =
    status === 'busy'
      ? p.busy
      : status === 'noroute'
        ? p.noRoute
        : status === 'blocked'
          ? p.blocked
          : status === 'error'
            ? p.unreachable
            : undefined;
  return (
    <section
      className={styles.card}
      data-testid="map-plan"
      aria-label={route.name}
      aria-live="polite"
    >
      <p className={styles.cardTitle}>{route.name}</p>
      {message ? <p className={styles.note}>{message}</p> : null}
      {plan ? (
        <>
          <p className={styles.note} data-testid="map-plan-summary">
            {p.summary(
              (() => {
                const d = formatDistance(plan.distance, (n) =>
                  formatNumber(n, { maximumFractionDigits: 1 }),
                );
                return `${d.value} ${d.unit}`;
              })(),
              formatTime(plan.duration),
            )}
          </p>
          <h3 className={styles.stepsTitle}>{p.steps}</h3>
          <ol className={styles.steps} data-testid="map-plan-steps">
            {plan.steps.map((s, i) => (
              <li key={i}>{stepText(s)}</li>
            ))}
          </ol>
          <p className={styles.note}>{p.attribution}</p>
        </>
      ) : null}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onHide}>
          {p.hide}
        </Button>
      </div>
    </section>
  );
}

export default function MapsPage() {
  const places = useLiveQuery(() => placeRepo.active().sortBy('createdAt'), []);
  const routes = useLiveQuery(() => routeRepo.active().sortBy('createdAt'), []);
  const [prefs] = useSettings('module.maps', settings.schema, settings.defaults);
  const { tileUrl, searchUrl, routingUrl } = servicesOf(
    prefs as Record<string, unknown> | undefined,
  );
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('view') as Tab)
    ? (params.get('view') as Tab)
    : 'places';
  const setTab = (next: Tab) =>
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        q.set('view', next);
        return q;
      },
      { replace: true },
    );

  const [placeTarget, setPlaceTarget] = useState<PlaceTarget>(null);
  const [routeTarget, setRouteTarget] = useState<RouteTarget>(null);
  const [selected, setSelected] = useState<Selection>();
  const [mapView, setMapView] = useState<View>();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>();
  const [searching, setSearching] = useState<'idle' | 'busy' | 'error'>('idle');
  const [note, setNote] = useState('');
  const [shown, setShown] = useState<Shown>();
  const searchInput = useRef<HTMLInputElement>(null);
  const view = mapView ?? fitView(places ?? [], 800, 480) ?? GERMANY;

  // The map (and with it every tile request) only starts once its tab is open and the notice is read.
  useEffect(() => {
    if (tab !== 'map' || ready) return;
    void requireNotice('maps').then(() => setReady(true));
  }, [tab, ready]);

  // `?new=1` (Quick-Add): the map tab with the search field ready.
  useEffect(() => {
    if (!params.get('new')) return;
    setParams({ view: 'map' }, { replace: true });
    setTimeout(() => searchInput.current?.focus(), 50);
  }, [params, setParams]);

  useOpenParam(
    async (id) =>
      ((await placeRepo.get(id)) as Stored<Place> | Stored<Route> | undefined) ?? routeRepo.get(id),
    (record) => {
      if ('lat' in record) {
        show({ lat: record.lat, lon: record.lon, label: record.name, place: record });
        return { view: 'map' };
      }
      setRouteTarget(record);
      return { view: 'routes' };
    },
  );

  function show(s: Selection) {
    setSelected(s);
    setMapView({ lat: s.lat, lon: s.lon, zoom: Math.max(view.zoom, 15) });
    setTab('map');
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching('busy');
    setNote('');
    try {
      await requireNotice('maps');
      setReady(true);
      setHits(await searchPlaces(query, { baseUrl: searchUrl, lang: getLang().split('-')[0]! }));
      setSearching('idle');
    } catch {
      setHits(undefined);
      setSearching('error');
    }
  }

  /** Only on click and after the notice: asks the routing service, then shows the line on the map. */
  async function calculate(r: Stored<Route>) {
    if (!isDrivingMode(r.mode)) return;
    setTab('map');
    setSelected(undefined);
    setShown({ route: r, status: 'busy' });
    try {
      await requireNotice('maps-route');
      setReady(true);
      const plan = await fetchPlan(r.mode, [r.from, ...r.via, r.to], { template: routingUrl });
      setShown({ route: r, status: 'ok', plan });
      setMapView(fitView(plan.line, 800, 480) ?? undefined);
    } catch (e) {
      const why = e instanceof MapsError ? e.message : 'error';
      setShown({
        route: r,
        status: why === 'noroute' ? 'noroute' : why === 'blocked' ? 'blocked' : 'error',
      });
    }
  }

  function choose(h: Hit) {
    setHits(undefined);
    setQuery('');
    setSelected({ lat: h.lat, lon: h.lon, label: h.label });
    setMapView({ lat: h.lat, lon: h.lon, zoom: 16 });
  }

  function locate() {
    if (!('geolocation' in navigator)) return setNote(t.maps.map.locateFailed);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lon = roundCoord(pos.coords.longitude);
        setSelected({ lat, lon, label: t.maps.map.picked });
        setMapView({ lat, lon, zoom: 16 });
      },
      () => setNote(t.maps.map.locateFailed),
      { timeout: 8000 },
    );
  }

  const markers: MapMarker[] = (places ?? []).map((p) => ({
    id: p.id,
    lat: p.lat,
    lon: p.lon,
    label: p.name,
    kind: 'place',
  }));
  const asEnd = (s: Selection): Endpoint => ({
    label: shortLabel(s.label),
    lat: s.lat,
    lon: s.lon,
  });
  const km = (n: number) => formatNumber(n, { maximumFractionDigits: 1 });
  const dist = (a: Endpoint, b: Endpoint) => {
    const d = formatDistance(distanceMeters(a, b), (n) =>
      formatNumber(n, { maximumFractionDigits: 1 }),
    );
    return `${d.value} ${d.unit}`;
  };
  void km;

  const placeMenu = (p: Stored<Place>): RowMenuItem[] => [
    {
      id: 'show',
      label: t.maps.map.showOnMap,
      onSelect: () => show({ lat: p.lat, lon: p.lon, label: p.name, place: p }),
    },
    ...apps().map((a) => ({
      id: `open-${a}`,
      group: t.maps.map.openIn,
      label: t.maps.apps[a],
      onSelect: () => openUrl(placeLink(a, { lat: p.lat, lon: p.lon, label: p.name })),
    })),
    { id: 'edit', label: t.actions.edit, onSelect: () => setPlaceTarget(p) },
    {
      id: 'delete',
      label: t.actions.delete,
      danger: true,
      onSelect: () => void deleteWithUndo(() => placeRepo.remove(p.id)),
    },
  ];
  const routeMenu = (r: Stored<Route>): RowMenuItem[] => [
    ...(isDrivingMode(r.mode)
      ? [{ id: 'calculate', label: t.maps.plan.show, onSelect: () => void calculate(r) }]
      : []),
    ...apps().flatMap((a) => {
      const url = routeLink(a, r.mode, r.from, r.to, r.via);
      return url
        ? [
            {
              id: `open-${a}`,
              group: t.maps.route.openIn,
              label: t.maps.apps[a],
              onSelect: () => openUrl(url),
            },
          ]
        : [];
    }),
    { id: 'edit', label: t.actions.edit, onSelect: () => setRouteTarget(r) },
    {
      id: 'delete',
      label: t.actions.delete,
      danger: true,
      onSelect: () => void deleteWithUndo(() => routeRepo.remove(r.id)),
    },
  ];

  const attribution =
    tileUrl === DEFAULT_TILE_URL ? (
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
        {t.maps.map.attribution}
      </a>
    ) : (
      t.maps.map.source(new URL(tileUrl.replace(/\{[zxy]\}/g, '0')).host)
    );

  return (
    <>
      <PageHeader title={t.maps.meta.name}>
        <Button variant="primary" onClick={() => setRouteTarget({ draft: true })}>
          <Icon name="route" size={18} />
          {t.maps.add.route}
        </Button>
      </PageHeader>
      <Segmented
        label={t.maps.tabs.label}
        value={tab}
        options={TABS.map((v) => ({ value: v, label: t.maps.tabs[v] }))}
        onChange={setTab}
      />

      {tab === 'places' ? (
        places && places.length === 0 ? (
          <EmptyState title={t.maps.empty.places}>
            <Button variant="primary" onClick={() => setTab('map')}>
              {t.maps.add.place}
            </Button>
          </EmptyState>
        ) : (
          <ItemList>
            {(places ?? []).map((p) => (
              <ItemRow
                key={p.id}
                title={p.name}
                meta={[t.maps.categories[p.category], p.address].filter(Boolean).join(' · ')}
                lead={<Icon name={CATEGORY_ICON[p.category]} size={20} />}
                onOpen={() => show({ lat: p.lat, lon: p.lon, label: p.name, place: p })}
                menu={placeMenu(p)}
                menuLabel={t.maps.meta.name}
              />
            ))}
          </ItemList>
        )
      ) : null}

      {tab === 'routes' ? (
        routes && routes.length === 0 ? (
          <EmptyState title={t.maps.empty.routes}>
            <Button variant="primary" onClick={() => setRouteTarget({ draft: true })}>
              {t.maps.add.route}
            </Button>
          </EmptyState>
        ) : (
          <ItemList>
            {(routes ?? []).map((r) => (
              <ItemRow
                key={r.id}
                title={r.name}
                meta={`${t.maps.modes[r.mode]} · ${r.from.label} → ${r.to.label} · ${t.maps.route.distance(dist(r.from, r.to))}`}
                lead={<Icon name={MODE_ICON[r.mode]} size={20} />}
                onOpen={() => setRouteTarget(r)}
                menu={routeMenu(r)}
                menuLabel={t.maps.meta.name}
              />
            ))}
          </ItemList>
        )
      ) : null}

      {tab === 'map' ? (
        <div className={styles.mapTab}>
          <form className={styles.search} onSubmit={(e) => void search(e)}>
            <div className={styles.searchField}>
              <TextField
                ref={searchInput}
                label={t.maps.map.search}
                hint={t.maps.map.searchHint}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={query.trim().length < 2 || searching === 'busy'}
            >
              <Icon name="search" size={18} />
              {searching === 'busy' ? t.maps.map.searching : t.maps.map.searchButton}
            </Button>
          </form>
          {searching === 'error' ? <p className={styles.note}>{t.maps.map.unreachable}</p> : null}
          {hits && hits.length === 0 ? <p className={styles.note}>{t.maps.map.noResults}</p> : null}
          {hits && hits.length > 0 ? (
            <ul className={styles.hits} data-testid="map-hits">
              {hits.map((h) => (
                <li key={`${h.lat},${h.lon},${h.label}`}>
                  <button type="button" className={styles.hit} onClick={() => choose(h)}>
                    <Icon name="mapPin" size={18} />
                    <span>{h.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {note ? <p className={styles.note}>{note}</p> : null}

          {ready ? (
            <TileMap
              view={view}
              onView={setMapView}
              template={tileUrl}
              markers={markers}
              selected={selected && !selected.place ? selected : undefined}
              line={shown?.plan?.line}
              onPick={(lat, lon) =>
                setSelected({
                  lat: roundCoord(lat),
                  lon: roundCoord(lon),
                  label: t.maps.map.picked,
                })
              }
              onMarker={(id) => {
                const p = (places ?? []).find((x) => x.id === id);
                if (p) setSelected({ lat: p.lat, lon: p.lon, label: p.name, place: p });
              }}
              onLocate={locate}
              labels={{
                map: t.maps.map.label,
                zoomIn: t.maps.map.zoomIn,
                zoomOut: t.maps.map.zoomOut,
                locate: t.maps.map.locate,
                blocked: t.maps.map.blocked,
                failed: t.maps.map.failed,
              }}
              attribution={attribution}
            />
          ) : (
            <p className={styles.note}>{t.maps.map.hint}</p>
          )}

          {shown ? <PlanCard shown={shown} onHide={() => setShown(undefined)} /> : null}

          {selected ? (
            <section
              className={styles.card}
              data-testid="map-selection"
              aria-label={selected.label}
            >
              <p className={styles.cardTitle}>{selected.label}</p>
              <p className={styles.note}>
                {roundCoord(selected.lat)}, {roundCoord(selected.lon)}
              </p>
              <div className={styles.actions}>
                {selected.place ? (
                  <Button onClick={() => setPlaceTarget(selected.place!)}>{t.actions.edit}</Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      setPlaceTarget({
                        draft: true,
                        lat: selected.lat,
                        lon: selected.lon,
                        name:
                          selected.label === t.maps.map.picked
                            ? ''
                            : selected.label.split(',')[0]!.trim(),
                        address: selected.label === t.maps.map.picked ? undefined : selected.label,
                      })
                    }
                  >
                    <Icon name="plus" size={18} />
                    {t.maps.map.saveHere}
                  </Button>
                )}
                <Button onClick={() => setRouteTarget({ draft: true, from: asEnd(selected) })}>
                  {t.maps.map.routeFrom}
                </Button>
                <Button onClick={() => setRouteTarget({ draft: true, to: asEnd(selected) })}>
                  {t.maps.map.routeTo}
                </Button>
                <Button variant="ghost" onClick={() => setSelected(undefined)}>
                  {t.maps.map.clear}
                </Button>
              </div>
              <p className={styles.openIn}>
                <span>{t.maps.map.openIn}:</span>
                {apps().map((a) => (
                  <a
                    key={a}
                    href={placeLink(a, {
                      lat: selected.lat,
                      lon: selected.lon,
                      label: selected.label,
                    })}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {t.maps.apps[a]}
                  </a>
                ))}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      <PlaceEditor target={placeTarget} onClose={() => setPlaceTarget(null)} />
      <RouteEditor
        target={routeTarget}
        places={places ?? []}
        searchUrl={searchUrl}
        onClose={() => setRouteTarget(null)}
      />
    </>
  );
}
