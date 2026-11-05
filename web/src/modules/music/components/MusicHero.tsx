import { useMemo, type CSSProperties } from 'react';
import { Icon, useMediaQuery } from '@/ui';
import { HeroSlot, safeTint, toCss, useCoverTone } from '@/ui/identity';
import { useCover } from '../useCover';
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
 * Without a cover the module hue stays.
 */
export function MusicHero({ api }: { api: PlayerApi }) {
  const { np } = api;
  const cover = useCover(np.ctx, np.current?.coverUrl);
  const tone = useCoverTone(cover, np.current?.coverUrl);
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
          {cover ? <img src={cover} alt="" /> : <Icon name="music" size={56} />}
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
