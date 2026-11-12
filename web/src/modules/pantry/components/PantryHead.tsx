import { HeroFigure, HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { PLACES, type Place } from '../schema';

export type ShelfCounts = Record<
  Place,
  { items: number; expired: number; soon: number; low: number }
>;

/**
 * Head of the pantry (Identity 4.0): the count as the figure with one context line (expired, soon, low in words).
 * The places follow below as the page's own sections.
 */
export function PantryHead({ counts }: { counts: ShelfCounts }) {
  const places = PLACES.filter((p) => counts[p].items > 0);
  if (places.length === 0) return null;
  const total = places.reduce((n, p) => n + counts[p].items, 0);
  const sum = (k: 'expired' | 'soon' | 'low') => places.reduce((n, p) => n + counts[p][k], 0);
  const detail =
    t.pantry.shelf.summary(sum('expired'), sum('soon'), sum('low')) || t.pantry.shelf.summaryFine;
  return (
    <HeroSlot area="figure">
      <HeroFigure
        label={t.pantry.shelf.figureLabel}
        value={String(total)}
        unit={t.pantry.shelf.figureUnit}
        detail={detail}
        testId="pantry-total"
      />
    </HeroSlot>
  );
}
