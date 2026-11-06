import { getManifest } from '@/core/modules/registry';
import type { CalendarItem } from '@/core/modules/types';

/**
 * The hue of the module behind a summary chip (`kind: 'plan'`): the chip carries the planner's
 * `--module-color` through `data-hue` (tokens.css), so "Modulfarben: Aus" turns it grey like every
 * identity. Other kinds keep their own quiet tones and get none.
 */
export const sourceHue = (item: Pick<CalendarItem, 'kind' | 'source'>): string | undefined =>
  item.kind === 'plan' ? getManifest(item.source)?.identity?.hue : undefined;
