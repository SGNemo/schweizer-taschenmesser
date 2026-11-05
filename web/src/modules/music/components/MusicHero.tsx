import type { CSSProperties } from 'react';
import { Icon } from '@/ui';
import { HeroSlot, safeTint, toCss, useCoverTone } from '@/ui/identity';
import { useCover } from '../useCover';
import { NowPlayer } from './NowPlayer';
import type { PlayerApi } from './types';
import styles from '../routes/music.module.css';

/** Theme colour token as `#rrggbb` (empty when unset or not hex): the cover tint keeps the head's text AA against it. */
const token = (name: string): string =>
  typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * The music head, built from the module frame's slots: the cover large beside the title, the cover's dominant colour as the head's
 * tint (as strong as the text contrast allows, cached per cover), the player in the figure slot. Without a cover the module hue stays.
 */
export function MusicHero({ api }: { api: PlayerApi }) {
  const { np } = api;
  const cover = useCover(np.ctx, np.current?.coverUrl);
  const tone = useCoverTone(cover, np.current?.coverUrl);
  const tint = tone ? safeTint(tone, token('--surface'), token('--text')) : 0;
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
      <HeroSlot area="figure">
        <NowPlayer api={api} />
      </HeroSlot>
    </>
  );
}
