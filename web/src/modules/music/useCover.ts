import { useEffect, useState, type RefObject } from 'react';
import type { ConnectorContext } from '@/core/connectors/types';
import { coverNeed, isCoverUrl, pickCover, type CoverImage } from '@/core/connectors/coverUrl';
import { acquireCover, peekCover } from './coverLoader';

/** What a cover is picked from: the sizes the connector handed out, or the single small one of an older reading. */
export interface CoverSource {
  coverUrl?: string;
  covers?: CoverImage[];
}

/** Width of each surface in CSS pixels (as its style sheet sets it); the picture is picked for that width times the screen's density. */
export const COVER_PX = {
  row: 32,
  widget: 56,
  tileSmall: 120,
  head: 144,
  hero: 168,
  tile: 200,
} as const;

/** The smallest picture that fills a surface of `cssPx`, never larger than needed. */
export function coverFor(item: CoverSource | undefined, cssPx: number): string | undefined {
  if (!item) return undefined;
  return (
    pickCover(item.covers, coverNeed(cssPx)) ??
    (isCoverUrl(item.coverUrl) ? item.coverUrl : undefined)
  );
}

/** True once the element came near the visible area (and from then on). Without a `frame` there is nothing to wait for. */
function useSeen(frame: RefObject<Element | null> | undefined): boolean {
  const [seen, setSeen] = useState(() => !frame || typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = frame?.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [frame, seen]);
  return seen;
}

/**
 * The cover as a local `blob:` URL: fetched through the platform (so the connection log sees it and "Netzwerk sperren" applies, and
 * the app's image policy stays as strict as it is), from Spotify's image hosts only, once per picture (`coverLoader`), and only once
 * `frame` is near the visible area. Without a connection (`ctx`) nothing is asked for. No cover on any failure; the icon stays.
 */
export function useCover(
  ctx: ConnectorContext | undefined,
  url: string | undefined,
  frame?: RefObject<Element | null>,
): string | undefined {
  const seen = useSeen(frame);
  const [cover, setCover] = useState<{ url: string; blob: string }>();
  useEffect(() => {
    if (!ctx || !url || !seen || !isCoverUrl(url)) return;
    let alive = true;
    const handle = acquireCover((u) => ctx.fetch(u), url);
    void handle.promise.then((blob) => {
      if (alive && blob) setCover({ url, blob });
    });
    return () => {
      alive = false;
      handle.release();
    };
  }, [ctx, url, seen]);
  if (!ctx || !url) return undefined;
  if (cover && cover.url === url) return cover.blob;
  // Already in memory (the same picture in another list): shown at once, the effect above claims it.
  return seen ? peekCover(url) : undefined;
}
