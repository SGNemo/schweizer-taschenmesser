import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { MediaItem } from '@/core/connectors/types';
import { tMusicPage } from '@/strings.musicPage';
import { Icon, useMediaQuery } from '@/ui';
import { HeroSlot, safeTint, toCss, useCoverTone } from '@/ui/identity';
import { readRecent } from '../recentOnce';
import { COVER_PX, coverFor, useCover } from '../useCover';
import { useThemeKey } from '../useThemeKey';
import { NowPlayer } from './NowPlayer';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

/** Theme colour token as `#rrggbb` (empty when unset or not hex): the cover tint keeps the head's text AA against it. */
const token = (name: string): string =>
  typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** "Ruhig" or "Modulfarben: Aus": no cover tone at all, like BankCard and Sky (C03). */
const calm = (): boolean => {
  if (typeof document === 'undefined') return false;
  const d = document.documentElement.dataset;
  return d.color === 'calm' || d.moduleColors === 'off';
};

/**
 * The music head, built from the module frame's slots: the cover large beside the title, the cover's dominant colour as the head's
 * tint (as strong as the text contrast allows for the current theme, re-checked on a theme switch; none under "Ruhig" or with module
 * colours off), the player in the figure slot. On the phone the player sits under the head in the page, so the head stays short (C10).
 * Without a cover the module hue stays. While nothing plays the cover field shows the song played last (only with the feature
 * "Verlauf"; no tint then, the head stays calm); without it the icon.
 */
export function MusicHero({ api }: { api: PlayerApi }) {
  const { np } = api;
  const tm = tMusicPage.use();
  const { source, ctx, features, current } = np;
  const wantsLast = !current && features.includes('history') && !!source.recent;
  const [last, setLast] = useState<MediaItem>();
  useEffect(() => {
    if (!wantsLast) return;
    let alive = true;
    readRecent(source, ctx, api.version)
      .then((items) => alive && setLast(items[0]))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [wantsLast, source, ctx, api.version]);
  const shownLast = wantsLast ? last : undefined;
  const url = coverFor(current ?? shownLast, COVER_PX.hero);
  const cover = useCover(ctx, url);
  // The tint belongs to what plays now; a cover from the history tints nothing.
  const tone = useCoverTone(current ? cover : undefined, current ? url : undefined);
  const alt = current
    ? (current.album ?? current.title)
    : shownLast
      ? tm.lastPlayedCover(shownLast.album ?? shownLast.name)
      : '';
  const themeKey = useThemeKey();
  const phone = useMediaQuery('(max-width: 899px)');
  const tint = useMemo(
    () => (tone && !calm() ? safeTint(tone, token('--surface'), token('--text')) : 0),
    // themeKey: the tokens change with the theme, so the tint is re-computed on a switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tone, themeKey],
  );
  const style =
    tone && tint > 0
      ? ({ '--tone': toCss(tone), '--tone-a': `${Math.round(tint * 100)}%` } as CSSProperties)
      : undefined;
  return (
    <>
      {style ? (
        <HeroSlot area="backdrop">
          <div className={styles.tone} style={style} data-testid="cover-tone" />
        </HeroSlot>
      ) : null}
      <HeroSlot area="signature">
        <div className={styles.coverLarge} data-testid="music-cover">
          {cover ? <img src={cover} alt={alt} title={alt} /> : <Icon name="music" size={56} />}
        </div>
      </HeroSlot>
      {phone ? (
        <div className={styles.phonePlayer} data-testid="music-player-page">
          <NowPlayer api={api} />
        </div>
      ) : (
        <HeroSlot area="figure">
          <NowPlayer api={api} />
        </HeroSlot>
      )}
    </>
  );
}
