import { useRef } from 'react';
import type { ConnectorContext } from '@/core/connectors/types';
import { Icon } from '@/ui';
import { coverFor, useCover, type CoverSource } from '../useCover';

/**
 * A cover inside its fixed frame (`className` sets width and the square ratio, so nothing moves when the picture arrives): the picture
 * sized for `px`, loaded only when the frame is near the visible area; the music icon while there is none.
 */
export function Cover({
  ctx,
  item,
  px,
  alt,
  className,
  icon,
  testId,
}: {
  ctx: ConnectorContext | undefined;
  item: CoverSource | undefined;
  /** Width of the frame in CSS pixels (`COVER_PX`). */
  px: number;
  /** Name of the playlist or album. */
  alt: string;
  className?: string;
  icon: number;
  testId?: string;
}) {
  const frame = useRef<HTMLSpanElement>(null);
  const cover = useCover(ctx, coverFor(item, px), frame);
  return (
    <span ref={frame} className={className} data-testid={testId}>
      {cover ? (
        <img src={cover} alt={alt} decoding="async" draggable={false} />
      ) : (
        <Icon name="music" size={icon} />
      )}
    </span>
  );
}
