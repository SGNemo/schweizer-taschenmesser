import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSettings } from '@/core/settings/settings';
import { tMusicPage } from '@/strings.musicPage';
import { tSpotify } from '@/strings.spotify';
import { Button, Card, EmptyState, PageTitle, Tabs } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { MusicHero } from '../components/MusicHero';
import { SideLists } from '../components/SideLists';
import { SourceView } from '../components/SourceView';
import { StartView } from '../components/StartView';
import { trackIdOf, type PlayerApi, type View } from '../components/types';
import { useShortcuts } from '../useShortcuts';
import { settings as moduleSettings, settingsSchema, type MusicPrefs } from '../settings';
import { useNowPlaying } from '../useNowPlaying';
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
  const np = useNowPlaying();
  const [view, setView] = useState<View>();
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const [stored] = useSettings('module.music', settingsSchema, moduleSettings.defaults as never);
  const prefs = stored ?? (moduleSettings.defaults as MusicPrefs);
  useShortcuts(
    np,
    prefs.shortcuts,
    () => setView({ type: 'search' }),
    trackIdOf(np?.current?.trackUrl),
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
    { id: 'search', view: { type: 'search' }, label: tx.tabSearch },
    { id: 'liked', view: { type: 'liked' }, label: tx.tabLiked },
    { id: 'recent', view: { type: 'recent' }, label: tx.navRecent },
    { id: 'queue', view: { type: 'queue' }, label: tx.navQueue },
  ];
  const isOn = (v?: View) => (v ? view?.type === v.type && !('id' in v) : !view);

  return (
    <>
      <PageTitle title={tm.name} />
      <MusicHero api={api} />
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
            <StartView api={api} />
          )}
        </div>
        <aside className={styles.aside}>
          <SideLists api={api} />
        </aside>
      </div>
    </>
  );
}
