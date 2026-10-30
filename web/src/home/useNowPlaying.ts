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
import {
  ConnectorError,
  type ConnectorContext,
  type NowPlaying,
  type NowPlayingCommand,
  type NowPlayingSource,
} from '@/core/connectors/types';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { tSpotify } from '@/strings.spotify';

export const def = connectors.find((c) => c.nowPlaying);

function initial(): NowPlaying | undefined {
  const stored = readStoredNow();
  return stored && now() - stored.at < SHOW_STALE_MS ? stored.value : undefined;
}

/** True while a media connector is connected with "Anzeigen" (what the Overview needs to offer the switch). */
export function useNowPlayingAvailable(): boolean {
  const status = useConnectorStatus(def?.id ?? '');
  return (
    !!def?.nowPlaying &&
    !!status &&
    status.state !== 'disconnected' &&
    status.state !== 'expired' &&
    status.features.includes('show')
  );
}

export interface NowPlayingHandle {
  source: NowPlayingSource;
  ctx: ConnectorContext;
  features: string[];
  /** The last reading (`undefined` = nothing plays) and the moment it was made (epoch ms). */
  current: NowPlaying | undefined;
  readAt: number;
  canControl: boolean;
  /** Runs a player action; handles "needs Premium" and "sign-in expired" like the line always did. */
  run(action: () => Promise<void>): Promise<boolean>;
  control(command: NowPlayingCommand): Promise<void>;
  refresh(delayMs?: number): void;
}

/**
 * Everything the "Läuft gerade" widget and its player dialog share: the poller (at most every 30 s while
 * visible, `core/connectors/nowPlaying.ts`), the last reading (device-local), Premium handling.
 * `undefined` while the connector is not connected with "Anzeigen"; `current` is `undefined` while nothing plays.
 */
export function useNowPlaying(): NowPlayingHandle | undefined {
  const status = useConnectorStatus(def?.id ?? '');
  const tx = tSpotify.use();
  const toast = useUiStore((st) => st.toast);
  const ctx = useMemo(() => (def ? createContext(def) : undefined), []);
  const [reading, setReading] = useState<{ value?: NowPlaying; at: number }>(() => ({
    value: initial(),
    at: now(),
  }));
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
        setReading({ value, at: now() });
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

  const refresh = (delayMs = 1000) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => poller.current?.refresh(), delayMs);
  };

  async function run(action: () => Promise<void>): Promise<boolean> {
    if (!def) return false;
    try {
      await action();
      return true;
    } catch (e) {
      if (e instanceof ConnectorError && e.code === 'premium-required') {
        setNoPremium(now());
        setNoPremiumState(true);
        toast(tx.premiumHint);
      } else if (e instanceof ConnectorError && e.code === 'expired') {
        void saveStatus(def.id, { state: 'expired', message: describeError(e) });
      }
      // Anything else (no active device, offline): nothing changes, no message here.
      return false;
    }
  }

  async function control(command: NowPlayingCommand) {
    const source = def?.nowPlaying;
    if (!source || !ctx) return;
    const ok = await run(() => source.control(ctx, command));
    if (!ok) return;
    if ((command === 'pause' || command === 'play') && reading.value) {
      const next = { ...reading.value, playing: command === 'play' };
      writeStoredNow(next, now());
      setReading({ value: next, at: now() });
    }
    // Spotify needs a moment before "next" shows up in the player state.
    refresh();
  }

  if (!active || !def?.nowPlaying || !ctx) return undefined;
  return {
    source: def.nowPlaying,
    ctx,
    features: status?.features ?? [],
    current: reading.value,
    readAt: reading.at,
    canControl,
    run,
    control,
    refresh,
  };
}
