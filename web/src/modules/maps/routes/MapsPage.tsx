import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { TileMap, type MapMarker, type TileResolver } from '../components/TileMap';
import { TransitCard, type Trip } from '../components/TransitCard';
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
import { createLocalTiles } from '../own/local';
import { watchTheme } from '../own/theme';
import { placeRepo, regionRepo, routeRepo, tileRepo } from '../repo';
import { connectionPath, fetchConnections } from '../transit';
import { describeStep, fetchPlan, isDrivingMode, splitDuration, type Plan } from '../routing';
import type { Endpoint, Place, Route } from '../schema';
import { offlineOnlyOf, servicesOf, settings, DEFAULT_TILE_URL } from '../settings';
import { loadTile } from '../tiles';
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
  const regions = useLiveQuery(() => regionRepo.active().toArray(), []);
  const [prefs] = useSettings('module.maps', settings.schema, settings.defaults);
  const { tileUrl, searchUrl, routingUrl, transitUrl } = servicesOf(
    prefs as Record<string, unknown> | undefined,
  );
  const offlineOnly = offlineOnlyOf(prefs as { offlineOnly?: unknown } | undefined);

  // The own map (stored vector tiles, docs/features/map-own.md) answers first; the online tiles only
  // fill what it does not cover, and nothing at all in offline-only mode. The map waits for the
  // regions and the settings, so the first frame never asks the internet for a covered area.
  const ownMaxZoom = useRef<number | undefined>(undefined);
  ownMaxZoom.current = regions?.length ? Math.max(...regions.map((r) => r.zooms.max)) : undefined;
  const local = useMemo(
    () => createLocalTiles({ read: (id) => tileRepo.get(id), maxZoom: () => ownMaxZoom.current }),
    [],
  );
  const [sourceVersion, setSourceVersion] = useState(0);
  const regionsKey = (regions ?? []).map((r) => `${r.id}:${r.updatedAt}`).join(',');
  useEffect(() => {
    // Drawn tiles follow the tokens and the stored data: both changes empty the memory and ask again.
    const refresh = () => {
      local.invalidate();
      setSourceVersion((v) => v + 1);
    };
    refresh();
    return watchTheme(refresh);
  }, [local, regionsKey]);
  const resolve: TileResolver = async (z, x, y, url) =>
    (await local.get(z, x, y)) ?? (offlineOnly ? {} : loadTile(url));
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
  const [trip, setTrip] = useState<Trip>();
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
    setTrip(undefined);
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

  /** Only on click and after the notice: asks the timetable service for connections from now. */
  async function findConnections(r: Stored<Route>) {
    setTab('map');
    setSelected(undefined);
    setShown(undefined);
    setTrip({ name: r.name, status: 'busy', index: 0 });
    try {
      await requireNotice('maps-transit');
      setReady(true);
      const options = await fetchConnections(r.from, r.to, { template: transitUrl });
      setTrip({ name: r.name, status: 'ok', options, index: 0 });
      setMapView(fitView(connectionPath(options[0]!), 800, 480) ?? undefined);
    } catch (e) {
      const why = e instanceof MapsError ? e.message : 'error';
      setTrip({
        name: r.name,
        status: why === 'noroute' ? 'none' : why === 'blocked' ? 'blocked' : 'error',
        index: 0,
      });
    }
  }

  function pickConnection(index: number) {
    if (!trip?.options?.[index]) return;
    setTrip({ ...trip, index });
    setMapView(fitView(connectionPath(trip.options[index]), 800, 480) ?? undefined);
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
      : [
          {
            id: 'connections',
            label: t.maps.transit.show,
            onSelect: () => void findConnections(r),
          },
        ]),
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

  // The own map is OpenStreetMap data as well: the credit stays whatever the online source is.
  const attribution =
    tileUrl === DEFAULT_TILE_URL || (regions?.length ?? 0) > 0 ? (
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
          <p className={styles.note}>{t.maps.map.searchHint}</p>
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

          {ready && regions && prefs ? (
            <TileMap
              view={view}
              onView={setMapView}
              template={tileUrl}
              resolve={resolve}
              resolveKey={`${sourceVersion}:${offlineOnly ? 'own' : 'all'}`}
              markers={markers}
              selected={selected && !selected.place ? selected : undefined}
              line={
                shown?.plan?.line ??
                (trip?.options ? connectionPath(trip.options[trip.index]!) : undefined)
              }
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
          {trip ? (
            <TransitCard trip={trip} onPick={pickConnection} onHide={() => setTrip(undefined)} />
          ) : null}

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
