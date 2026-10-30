import { useEffect, useState } from 'react';
import { createContext } from '@/core/connectors/context';
import { connectors } from '@/core/connectors/registry';
import { useConnectorStatus } from '@/core/connectors/state';
import type { ConnectorDef, Playlist } from '@/core/connectors/types';
import { MUSIC_MODES, setMusic, useFocusMusic, useMusicAvailable } from '@/core/focus/music';
import { tSpotify } from '@/strings.spotify';
import { Segmented, SelectField, SettingRow, Switch } from '@/ui';
import { FoldedGroup } from './FoldedGroup';
import styles from './settings.module.css';

const media = (): ConnectorDef | undefined => connectors.find((c) => c.nowPlaying?.startPlaylist);

type Loaded = { state: 'ready'; lists: Playlist[] } | { state: 'error' } | undefined;

/** The playlists are read when the row is opened and kept in memory only; just the chosen id is stored. */
function PlaylistPicker({ def, open }: { def: ConnectorDef; open: boolean }) {
  const tx = tSpotify.use();
  const [music] = useFocusMusic();
  const status = useConnectorStatus(def.id);
  const [loaded, setLoaded] = useState<Loaded>();
  const granted = status?.features.includes('playlists') ?? false;

  useEffect(() => {
    if (!open || !granted || !def.nowPlaying?.playlists) return;
    let alive = true;
    def.nowPlaying
      .playlists(createContext(def))
      .then((lists) => alive && setLoaded({ state: 'ready', lists }))
      .catch(() => alive && setLoaded({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, [open, granted, def]);

  if (!granted)
    return (
      <p className={styles.muted} data-testid="focus-music-reconnect">
        {tx.playlistReconnect}
      </p>
    );
  if (loaded === undefined) return <p className={styles.muted}>{tx.playlistLoading}</p>;
  if (loaded.state === 'error') return <p className={styles.muted}>{tx.playlistUnavailable}</p>;
  if (loaded.lists.length === 0) return <p className={styles.muted}>{tx.playlistNone}</p>;
  const known = loaded.lists.some((l) => l.id === music.playlistId);
  return (
    <>
      <SelectField
        label={tx.playlistLabel}
        value={known ? music.playlistId : ''}
        onChange={(e) => setMusic({ playlistId: e.target.value || undefined })}
        data-testid="focus-music-playlist"
      >
        <option value="">{tx.playlistChoose}</option>
        {loaded.lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </SelectField>
      {!known ? <p className={styles.muted}>{tx.playlistNeeded}</p> : null}
    </>
  );
}

/**
 * Settings → Fokus & Aufmerksamkeit → Weitere Einstellungen: "Musik in der Fokus-Runde: Aus". Folded,
 * off by default, and only there while Spotify is connected with "Steuern" (and not ruled out as
 * Premium-less). Device-local (`core/focus/music.ts`).
 */
export function FocusMusicRow() {
  const available = useMusicAvailable();
  const tx = tSpotify.use();
  const [music] = useFocusMusic();
  const [open, setOpen] = useState(false);
  const def = media();
  if (!available || !def) return null;
  const label: Record<(typeof MUSIC_MODES)[number], string> = {
    off: tx.musicOff,
    resume: tx.musicResume,
    playlist: tx.musicPlaylist,
  };
  return (
    <FoldedGroup
      section="focus"
      id="music"
      title={tx.musicTitle}
      current={[label[music.mode]]}
      onToggle={setOpen}
    >
      <SettingRow id="focus--music" label={tx.musicTitle} description={tx.musicHint}>
        <Segmented<string>
          label={tx.musicTitle}
          value={music.mode}
          options={MUSIC_MODES.map((m) => ({ value: m, label: label[m] }))}
          onChange={(v) => setMusic({ mode: v as (typeof MUSIC_MODES)[number] })}
        />
      </SettingRow>
      {music.mode === 'resume' ? <p className={styles.muted}>{tx.musicResumeHint}</p> : null}
      {music.mode === 'playlist' ? <PlaylistPicker def={def} open={open} /> : null}
      {music.mode !== 'off' ? (
        <SettingRow id="focus--musicEnd" label={tx.pauseAtEnd} description={tx.pauseAtEndHint}>
          <Switch
            label={tx.pauseAtEnd}
            labelHidden
            checked={music.pauseAtEnd}
            onChange={(v) => setMusic({ pauseAtEnd: v })}
          />
        </SettingRow>
      ) : null}
    </FoldedGroup>
  );
}
