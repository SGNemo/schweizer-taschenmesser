/**
 * The offer P5 (planner hub 2, package 2; hand-off 02 „The offer“): one quiet line at the top of „Noch ohne Tag“ when at
 * least three single rows of one area wait there and its switch was never set. Text, one quiet button, ✕ at the end
 * („Nicht mehr anbieten“, P13 – device-local, no toast). The button sets the switch (toast P6 with „Rückgängig“).
 */
import { useState } from 'react';
import type { PileArea } from '@/core/modules/types';
import { t } from '@/strings';
import { Button, Icon, IconButton } from '@/ui';
import { acceptPileOffer, dismissPileOffer, pileOfferDismissed } from '../pileSwitch';
import styles from '../routes/planner.module.css';

/** From this many waiting rows of one area the offer shows. */
export const OFFER_FROM = 3;

export function PileOffer({ area, n }: { area: PileArea; n: number }) {
  const [gone, setGone] = useState(() => pileOfferDismissed(area));
  if (gone || n < OFFER_FROM) return null;
  return (
    <p className={styles.pileOffer} data-testid="pile-offer">
      <span>{t.planner.pile.offer(n, t.planner.pile.area[area])}</span>
      <Button variant="ghost" onClick={() => void acceptPileOffer(area)}>
        {t.planner.pile.offerAction}
      </Button>
      <IconButton
        label={t.planner.pile.offerClose}
        onClick={() => {
          dismissPileOffer(area);
          setGone(true);
        }}
      >
        <Icon name="close" size={16} />
      </IconButton>
    </p>
  );
}
