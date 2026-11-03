import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useHeroTargets, type HeroArea } from '@/core/shell/heroContext';

/**
 * Content for the free slot of the module head: the module's signature or headline block (sky, bank cards, cover).
 * Renders nothing when there is no shell around (tests, dialogs). Keep it decorative or a figure with its context line.
 */
export function HeroSlot({
  area = 'extra',
  children,
}: {
  /** `extra` beside the title (default), `figure` under it, `backdrop` behind everything, `notice` above the head. */
  area?: Exclude<HeroArea, 'title'>;
  children: ReactNode;
}) {
  const targets = useHeroTargets();
  const target = targets?.[area];
  return target ? createPortal(children, target) : null;
}
