import { t } from '@/strings';
import { KachelnBody, type Kachel } from '@/ui';
import { HeroFigure, HeroSlot, SignaturePlate } from '@/ui/identity';
import styles from '../routes/maps.module.css';

/**
 * The `regal` head of Karten & Orte (identity v3.1, G11): the count of saved places as the figure (the last place as
 * its context line) and, in slot M, the pin plate beside category tiles (`KachelnBody`: count + category, the four
 * biggest). The head draws no map and fetches nothing; the plate is decoration, the tiles are text.
 */
export function MapsHead({
  count,
  last,
  tiles,
}: {
  count: number;
  last?: string;
  tiles: Kachel[];
}) {
  return (
    <>
      <HeroSlot area="figure">
        <HeroFigure
          label={t.maps.tabs.places}
          value={String(count)}
          detail={last ? t.maps.placesBar.last(last) : t.maps.placesBar.pinHint}
          testId="maps-count"
        />
      </HeroSlot>
      <HeroSlot area="signature">
        <div className={styles.headShelf} data-testid="pin-shelf">
          <SignaturePlate id="pin" size="M" />
          {tiles.length > 0 ? (
            <div className={styles.headTiles}>
              <KachelnBody tiles={tiles} />
            </div>
          ) : null}
        </div>
      </HeroSlot>
    </>
  );
}
