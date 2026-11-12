import { t } from '@/strings';
import { HeroFigure, HeroSlot } from '@/ui/identity';

/**
 * The head of Karten & Orte (Identity 4.0, package 0b-4b): the count of saved places as the figure, the last place
 * as its context line. The pin plate and the category tiles left the signature slot: the category chips of the
 * list filter by the same categories, and the page starts with its content. The head draws no map and fetches nothing.
 */
export function MapsHead({ count, last }: { count: number; last?: string }) {
  return (
    <HeroSlot area="figure">
      <HeroFigure
        label={t.maps.tabs.places}
        value={String(count)}
        unit={t.maps.placesBar.unit(count)}
        detail={last ? t.maps.placesBar.last(last) : t.maps.placesBar.pinHint}
        testId="maps-count"
      />
    </HeroSlot>
  );
}
