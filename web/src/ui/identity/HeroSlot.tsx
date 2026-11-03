import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useHeroTargets } from '@/core/shell/heroContext';

/**
 * Content for the free slot of the module head: the module's signature or headline block (sky, bank cards, cover).
 * Renders nothing when there is no shell around (tests, dialogs). Keep it decorative or a figure with its context line.
 */
export function HeroSlot({ children }: { children: ReactNode }) {
  const targets = useHeroTargets();
  return targets?.extra ? createPortal(children, targets.extra) : null;
}
