/**
 * The offer P5 (planner hub 2, package 2; hand-off 02 „The offer“): one quiet line at the top of „Noch ohne Tag“ when at
 * least three single rows of one area wait there and its switch was never set. Text, one quiet button, ✕ at the end
 * („Nicht mehr anbieten“, P13 – device-local, no toast). The button sets the switch (toast P6 with „Rückgängig“).
 */
import { useRef, useState } from 'react';
import { pileKey } from '@/core/modules/pile';
import type { PileArea } from '@/core/modules/types';
import { t } from '@/strings';
import { Button, Icon, IconButton } from '@/ui';
import { acceptPileOffer, dismissPileOffer, OFFER_FROM, pileOfferDismissed } from '../pileSwitch';
import styles from '../routes/planner.module.css';

/** Focus a row's title once it is there (the new pile row comes with the board's next reading). */
function focusWhenThere(find: () => HTMLElement | null | undefined, tries = 30) {
  const el = find();
  if (el) el.focus({ preventScroll: false });
  else if (tries > 0) setTimeout(() => focusWhenThere(find, tries - 1), 100);
}

export function PileOffer({ area, n }: { area: PileArea; n: number }) {
  const [gone, setGone] = useState(() => pileOfferDismissed(area));
  const line = useRef<HTMLParagraphElement>(null);
  if (gone || n < OFFER_FROM) return null;
  return (
    <p ref={line} className={styles.pileOffer} data-testid="pile-offer">
      <span>{t.planner.pile.offer(n, t.planner.pile.area[area])}</span>
      <Button
        variant="ghost"
        onClick={() => {
          // The focus goes to the new row's title, not to the page's start.
          void acceptPileOffer(area).then(() =>
            focusWhenThere(() =>
              document.querySelector<HTMLElement>(
                `[data-row-key="${pileKey(area)}"] button[data-row]`,
              ),
            ),
          );
        }}
      >
        {t.planner.pile.offerAction}
      </Button>
      <IconButton
        label={t.planner.pile.offerClose}
        onClick={() => {
          // The focus goes to the group's first row.
          const first = line.current?.parentElement?.querySelector<HTMLElement>('button[data-row]');
          dismissPileOffer(area);
          setGone(true);
          first?.focus();
        }}
      >
        <Icon name="close" size={16} />
      </IconButton>
    </p>
  );
}
