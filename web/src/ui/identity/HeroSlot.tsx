import { useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useHeroControls, useHeroTargets, type HeroArea } from '@/core/shell/heroContext';

/**
 * Renders its children into the module head (`layout/AreaFrame`): `signature` is the slot the head variant sizes
 * for the module's signature (the frame draws the default mark until a page fills it), `figure` the headline
 * block under the title, `extra` strips and controls, `backdrop`/`notice` decoration and a notice above. Outside a
 * head (settings, dialogs, tests) it renders nothing. Mounting claims the area, so the frame's default steps back.
 */
export function HeroSlot({
  area = 'extra',
  children,
}: {
  area?: Exclude<HeroArea, 'title'>;
  children: ReactNode;
}) {
  const targets = useHeroTargets();
  const controls = useHeroControls();
  // Before paint, so the frame never shows its default for a slot the page is about to fill.
  useLayoutEffect(() => controls?.claim(area), [controls, area]);
  const target = targets?.[area];
  return target ? createPortal(children, target) : null;
}
