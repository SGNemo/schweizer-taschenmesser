import { useEffect, useMemo, useRef, useState } from 'react';
import { createContext } from '@/core/connectors/context';
import {
  NO_PREMIUM_MS,
  SHOW_STALE_MS,
  noPremiumSince,
  readStoredNow,
  setNoPremium,
  startPoller,
  writeStoredNow,
  type Poller,
} from '@/core/connectors/nowPlaying';
import { connectors } from '@/core/connectors/registry';
import { describeError } from '@/core/connectors/service';
import { saveStatus, useConnectorStatus } from '@/core/connectors/state';
import { ConnectorError, type NowPlaying, type NowPlayingCommand } from '@/core/connectors/types';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { tSpotify } from '@/strings.spotify';
import { Button, Icon } from '@/ui';
import styles from './Home.module.css';

const def = connectors.find((c) => c.nowPlaying);

function initial(): NowPlaying | undefined {
  const stored = readStoredNow();
  return stored && now() - stored.at < SHOW_STALE_MS ? stored.value : undefined;
}

/**
 * One calm line under the weather: "Läuft gerade: Titel – Interpret" with Pause/Weiter and Nächster.
 * Not there until a media connector (Spotify) is connected with "Anzeigen" – and not there while
 * nothing plays. No cover, no progress bar, no colour. The title opens the service. Reads at most every
 * 30 s while the app is visible (`core/connectors/nowPlaying.ts`); the last reading lives on this device.
 * Without Premium the controls disappear (once, with a quiet hint); the display stays.
 */
export function NowPlayingLine() {
  const status = useConnectorStatus(def?.id ?? '');
  const tx = tSpotify.use();
  const toast = useUiStore((st) => st.toast);
  const ctx = useMemo(() => (def ? createContext(def) : undefined), []);
  const [current, setCurrent] = useState<NowPlaying | undefined>(initial);
  const [noPremium, setNoPremiumState] = useState(() => {
    const since = noPremiumSince();
    return since !== undefined && now() - since < NO_PREMIUM_MS;
  });
  const poller = useRef<Poller | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const active =
    !!def?.nowPlaying &&
    !!status &&
    status.state !== 'disconnected' &&
    status.state !== 'expired' &&
    status.features.includes('show');
  const canControl = active && !!status?.features.includes('control') && !noPremium;

  useEffect(() => {
    if (!active || !def?.nowPlaying || !ctx) return;
    const source = def.nowPlaying;
    const p = startPoller(async () => {
      try {
        const value = await source.read(ctx);
        writeStoredNow(value, now());
        setCurrent(value);
      } catch (e) {
        if (e instanceof ConnectorError && e.code === 'expired')
          void saveStatus(def.id, { state: 'expired', message: describeError(e) });
        // Rate limit: wait as long as the service asks. Anything else: keep the last reading, no message.
        if (e instanceof ConnectorError && e.code === 'rate-limited') return e.retryAfter ?? 60;
      }
      return undefined;
    });
    poller.current = p;
    return () => {
      p.stop();
      poller.current = undefined;
      clearTimeout(timer.current);
    };
  }, [active, ctx]);

  async function control(command: NowPlayingCommand) {
    if (!def?.nowPlaying || !ctx) return;
    try {
      await def.nowPlaying.control(ctx, command);
      if (command !== 'next' && current) {
        const next = { ...current, playing: command === 'play' };
        writeStoredNow(next, now());
        setCurrent(next);
      }
      // Spotify needs a moment before "next" shows up in the player state.
      clearTimeout(timer.current);
      timer.current = setTimeout(() => poller.current?.refresh(), 1000);
    } catch (e) {
      if (e instanceof ConnectorError && e.code === 'premium-required') {
        setNoPremium(now());
        setNoPremiumState(true);
        toast(tx.premiumHint);
      } else if (e instanceof ConnectorError && e.code === 'expired') {
        void saveStatus(def.id, { state: 'expired', message: describeError(e) });
      }
      // Anything else (no active device, offline): the line stays as it is, no message.
    }
  }

  if (!active || !current) return null;
  const lead = tx.lead(current.playing ? tx.playing : tx.paused);
  return (
    <div className={styles.nowPlaying} data-testid="now-playing-line">
      <Icon name="play" size={16} />
      <span className={styles.nowPlayingText}>
        {lead}
        {current.trackUrl ? (
          <a href={current.trackUrl} target="_blank" rel="noreferrer noopener">
            {current.title}
          </a>
        ) : (
          current.title
        )}
        {current.artist ? ` – ${current.artist}` : ''}
      </span>
      {canControl ? (
        <span role="group" aria-label={tx.controlsLabel} className={styles.nowPlayingControls}>
          <Button
            variant="ghost"
            data-testid="now-playing-toggle"
            onClick={() => void control(current.playing ? 'pause' : 'play')}
          >
            {current.playing ? tx.pause : tx.resume}
          </Button>
          <Button
            variant="ghost"
            data-testid="now-playing-next"
            onClick={() => void control('next')}
          >
            {tx.next}
          </Button>
        </span>
      ) : null}
    </div>
  );
}
