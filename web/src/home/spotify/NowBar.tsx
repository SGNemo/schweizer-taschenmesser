import { useEffect, useState } from 'react';
import type { PlayerDevice, PlayerState } from '@/core/connectors/types';
import { getPlatform } from '@/core/platform';
import { tSpotify } from '@/strings.spotify';
import { Button, Icon, RowMenu } from '@/ui';
import { clock, useProgress } from '../nowPlayingTime';
import { useCover } from '../useCover';
import { trackUrl } from './TrackList';
import { useSavedTracks } from './useSavedTracks';
import { trackIdOf, type PlayerApi } from './types';
import styles from './Spotify.module.css';

const REPEAT: Record<NonNullable<PlayerState['repeat']>, NonNullable<PlayerState['repeat']>> = {
  off: 'context',
  context: 'track',
  track: 'off',
};

/**
 * The bar at the bottom of the player: what plays (cover, title, artist, album, a heart), the position,
 * the controls, volume and the device the music plays on. Everything is read when the player opens and
 * after each action; nothing is kept.
 */
export function NowBar({ api }: { api: PlayerApi }) {
  const tx = tSpotify.use();
  const { np } = api;
  const { source, ctx, current, canControl } = np;
  const cover = useCover(ctx, current?.coverUrl);
  const [player, setPlayer] = useState<PlayerState | undefined | 'none'>();
  const [devices, setDevices] = useState<PlayerDevice[]>([]);
  const [menu, setMenu] = useState(false);
  const [seekTo, setSeekTo] = useState<number>();
  const [volume, setVolume] = useState<number>();
  const [failed, setFailed] = useState(false);
  const id = trackIdOf(current?.trackUrl);
  const hearts = useSavedTracks(np, id ? [id] : []);

  useEffect(() => {
    let alive = true;
    source
      .state?.(ctx)
      .then((s) => alive && setPlayer(s ?? 'none'))
      .catch(() => undefined);
    source
      .devices?.(ctx)
      .then((d) => alive && setDevices(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [source, ctx, current?.title, current?.playing, api.version]);

  const position = useProgress(
    current?.progressMs,
    current?.durationMs,
    current?.playing ?? false,
    np.readAt,
  );
  const state = player && player !== 'none' ? player : undefined;

  async function act(action: () => Promise<void>) {
    setFailed(false);
    if (!(await api.act(action))) setFailed(true);
  }
  const commitSeek = () => {
    if (seekTo !== undefined) void act(() => source.seek!(ctx, seekTo));
    setSeekTo(undefined);
  };
  const commitVolume = () => {
    if (volume !== undefined) void act(() => source.setVolume!(ctx, volume));
    setVolume(undefined);
  };

  const deviceItems = devices.map((d) => ({
    id: d.id,
    label: d.active ? `${d.name} · ${tx.deviceActive}` : tx.deviceSwitch(d.name),
    checked: d.active,
    onSelect: () => void act(() => source.transfer!(ctx, d.id)),
  }));

  return (
    <div className={styles.bar}>
      <div className={styles.barNow}>
        <div className={styles.barCover}>
          {cover ? <img src={cover} alt="" /> : <Icon name="music" size={22} />}
        </div>
        <div className={styles.barText}>
          {current ? (
            <>
              <p className={styles.barTitle}>
                {current.trackUrl ? (
                  <a href={current.trackUrl} target="_blank" rel="noreferrer noopener">
                    {current.title}
                  </a>
                ) : (
                  current.title
                )}
              </p>
              <p className={styles.barSub}>
                {[current.artist, current.album].filter(Boolean).join(' · ')}
              </p>
            </>
          ) : (
            <p className={styles.barTitle}>{tx.nothingPlaying}</p>
          )}
          {state?.device ? <p className={styles.barSub}>{tx.onDevice(state.device)}</p> : null}
          {player === 'none' ? <p className={styles.barSub}>{tx.noDevice}</p> : null}
        </div>
        {current && id && hearts.canSave ? (
          <button
            type="button"
            className={[styles.heart, hearts.saved[id] ? styles.heartOn : ''].join(' ')}
            aria-pressed={hearts.saved[id] === true}
            aria-label={hearts.saved[id] ? tx.unlike(current.title) : tx.like(current.title)}
            onClick={() => void hearts.toggle(id, !hearts.saved[id])}
          >
            <Icon name="heart" size={18} />
          </button>
        ) : null}
      </div>

      <div className={styles.barMid}>
        {canControl ? (
          <div className={styles.controls} role="group" aria-label={tx.controlsLabel}>
            {source.setShuffle ? (
              <Button
                variant="ghost"
                aria-pressed={state?.shuffle === true}
                aria-label={tx.shuffle}
                onClick={() => void act(() => source.setShuffle!(ctx, !(state?.shuffle === true)))}
              >
                <Icon name="shuffle" size={20} />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              aria-label={tx.previous}
              onClick={() => void np.control('previous')}
            >
              <Icon name="skipBack" size={22} />
            </Button>
            <Button
              data-testid="player-toggle"
              onClick={() => void np.control(current?.playing ? 'pause' : 'play')}
            >
              <Icon name={current?.playing ? 'pause' : 'play'} size={20} />
              {current?.playing ? tx.pause : tx.resume}
            </Button>
            <Button variant="ghost" aria-label={tx.next} onClick={() => void np.control('next')}>
              <Icon name="skipForward" size={22} />
            </Button>
            {source.setRepeat ? (
              <Button
                variant="ghost"
                aria-pressed={!!state?.repeat && state.repeat !== 'off'}
                aria-label={tx.repeatMode(
                  state?.repeat === 'track'
                    ? tx.repeatTrack
                    : state?.repeat === 'context'
                      ? tx.repeatAll
                      : tx.repeatOff,
                )}
                onClick={() =>
                  void act(() => source.setRepeat!(ctx, REPEAT[state?.repeat ?? 'off']))
                }
              >
                <Icon name={state?.repeat === 'track' ? 'repeatOne' : 'repeat'} size={20} />
              </Button>
            ) : null}
          </div>
        ) : (
          <p className={styles.note}>{tx.controlsNeeded}</p>
        )}
        {current && position !== undefined && current.durationMs ? (
          <div className={styles.seek}>
            <span className={styles.time}>{clock(seekTo ?? position)}</span>
            <input
              type="range"
              aria-label={tx.position}
              min={0}
              max={current.durationMs}
              step={1000}
              value={seekTo ?? position}
              disabled={!canControl || !source.seek}
              onChange={(e) => setSeekTo(Number(e.target.value))}
              onPointerUp={commitSeek}
              onKeyUp={commitSeek}
            />
            <span className={styles.time}>{clock(current.durationMs)}</span>
          </div>
        ) : null}
        {failed ? <p className={styles.note}>{tx.playFailed}</p> : null}
      </div>

      <div className={styles.barRight}>
        {canControl && source.setVolume && state?.volume !== undefined ? (
          <label className={styles.volume}>
            <Icon name="volume" size={18} />
            <span className="sr-only">{tx.volume}</span>
            <input
              type="range"
              aria-label={tx.volume}
              min={0}
              max={100}
              value={volume ?? state.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              onPointerUp={commitVolume}
              onKeyUp={commitVolume}
            />
            <span className={styles.time}>{volume ?? state.volume} %</span>
          </label>
        ) : null}
        {canControl && source.transfer && source.devices ? (
          <span className={styles.devices}>
            <Icon name="monitor" size={16} />
            <RowMenu
              label={tx.devices}
              items={
                deviceItems.length > 0
                  ? deviceItems
                  : [{ id: 'none', label: tx.deviceNone, onSelect: () => undefined }]
              }
              open={menu}
              onOpenChange={setMenu}
            />
          </span>
        ) : null}
        {current?.trackUrl ? (
          <Button
            variant="ghost"
            aria-label={tx.menuOpen}
            onClick={() => void getPlatform().app.openUrl(id ? trackUrl(id) : current.trackUrl!)}
          >
            <Icon name="external" size={18} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
