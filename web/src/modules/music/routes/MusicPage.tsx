import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSettings } from '@/core/settings/settings';
import { useHeadReady } from '@/core/shell/heroContext';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { Button, Card, EmptyState, PageTitle, Tabs } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { MusicHero } from '../components/MusicHero';
import { SideLists } from '../components/SideLists';
import { SourceView } from '../components/SourceView';
import { StartView } from '../components/StartView';
import { trackIdOf, type PlayerApi, type View } from '../components/types';
import { forgetLibrary } from '../library';
import { useShortcuts } from '../useShortcuts';
import { useSleepWatcher } from '../sleepTimer';
import { settings as moduleSettings, settingsSchema, type MusicPrefs } from '../settings';
import { useNowPlayingStatus } from '../useNowPlaying';
import styles from './music.module.css';

const CONNECTIONS = settingsPath('verbindungen');

/**
 * The music module's page, a full page in the module frame (not a dialog): the head shows what plays (cover large, its colour
 * tinting the head, controls, volume, device) or the way out without a device; below it the start view (recently played, your playlists
 * as covers) or the chosen list (saved songs, queue, search with results by type, a playlist with cover and tracks), picked with the chips;
 * the aside holds the next songs. Not connected: one calm next step. Everything is read on request; nothing is kept.
 */
export default function MusicPage() {
  const tx = tSpotify.use();
  const tm = tMusicPage.use();
  const { np, known } = useNowPlayingStatus();
  const [view, setView] = useState<View>();
  // 0b-8: the stage (cover, player) and the start view below it are built from the connection's first reads; the frame
  // paints head and page once they are back (`identity.firstRead`, at most 0.6 s; after that the player keeps its rows
  // until it is read), so nothing moves when they arrive.
  // Not connected: nothing to wait for once the status is read. A tab chosen while held (shortcut) replaces the start view.
  const [playerRead, setPlayerRead] = useState(false);
  const [startRead, setStartRead] = useState(false);
  const onPlayerRead = useCallback(() => setPlayerRead(true), []);
  const onStartRead = useCallback(() => setStartRead(true), []);
  useHeadReady(known && (!np || (np.firstRead && playerRead && (startRead || view !== undefined))));
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Leaving the page: the playlist names read for it go too.
  useEffect(() => () => forgetLibrary(), []);
  const [stored] = useSettings('module.music', settingsSchema, moduleSettings.defaults as never);
  const prefs = stored ?? (moduleSettings.defaults as MusicPrefs);
  useSleepWatcher(np);
  useShortcuts(
    np,
    prefs.shortcuts,
    () => setView({ type: 'search' }),
    trackIdOf(np?.current?.trackUrl),
    () => {
      np?.refresh(800);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setVersion((v) => v + 1), 1200);
    },
  );

  if (!np) {
    return (
      <>
        <PageTitle title={tm.name} />
        <div className={styles.empty} data-testid="music-empty">
          <EmptyState
            title={tm.notConnectedTitle}
            motif={<SignatureMark id="coverTone" size={64} />}
          >
            <p>{tm.notConnectedText}</p>
            <Link to={CONNECTIONS}>
              <Button variant="primary">{tm.connect}</Button>
            </Link>
          </EmptyState>
        </div>
      </>
    );
  }

  const api: PlayerApi = {
    np,
    version,
    playingId: trackIdOf(np.current?.trackUrl),
    act: async (action) => {
      const ok = await np.run(action);
      if (ok) {
        np.refresh(800);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setVersion((v) => v + 1), 1200);
      }
      return ok;
    },
    open: setView,
    playFromList: (item, list) =>
      np.source.play
        ? api.act(() => np.source.play!(np.ctx, item, [...list]))
        : Promise.resolve(false),
  };
  const views: { id: string; view?: View; label: string }[] = [
    { id: 'start', label: tm.start },
    { id: 'playlists', view: { type: 'playlists' }, label: tm.tabPlaylists },
    { id: 'albums', view: { type: 'albums' }, label: tm.tabAlbums },
    { id: 'search', view: { type: 'search' }, label: tx.tabSearch },
    { id: 'liked', view: { type: 'liked' }, label: tx.tabLiked },
  ];
  // A list opened from a tab keeps that tab marked (its way back is in the list's head); the songs played lately are
  // part of the start view.
  const from = view && 'back' in view ? view.back : undefined;
  const isOn = (v?: View) =>
    v
      ? (view?.type === v.type && !('id' in v)) || (typeof from === 'string' && from === v.type)
      : !view || from === 'start';

  return (
    <>
      <PageTitle title={tm.name} />
      <MusicHero api={api} onPlayerRead={onPlayerRead} />
      {/* The views are tabs at the lower edge of the stage, in the page: inside the head they would lift the stage
          over its 320 px. An open playlist is none of them (it is reached from the start view). */}
      <div className={styles.views}>
        <Tabs
          label={tm.nav}
          items={views.map((v) => ({ id: v.id, label: v.label, active: isOn(v.view) }))}
          onSelect={(id) => setView(views.find((v) => v.id === id)?.view)}
        />
      </div>
      <div className={styles.layout}>
        <div className={styles.main} data-testid="music-main">
          {view ? (
            <Card>
              <SourceView api={api} view={view} />
            </Card>
          ) : (
            <StartView api={api} onRead={onStartRead} />
          )}
        </div>
        <aside className={styles.aside}>
          <SideLists api={api} />
        </aside>
      </div>
    </>
  );
}
