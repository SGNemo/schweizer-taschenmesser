/**
 * The planner as a plan source of itself (planner hub 2, package 2, CONCEPT §0.1): its collective rows „Finanzen
 * checken“ and „E-Mails durchgehen“ (kind `pile`, ids `pile-money` / `pile-mail`) – one per switched-on area while an
 * active module has a part of it. They run through the collector, the input hash and the placement rows like any thing.
 * Nothing that changes with the count is handed over (no due date, no detail): a count that changes – also to 0 –
 * never makes a run write; what the row shows is read by the board (`piles.ts`). No write-back steps.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { pileId, pileKey } from '@/core/modules/pile';
import { t } from '@/strings';
import { loadPileParts, pileAreas, PILE_MINUTES } from './piles';
import { getPlannerSettings } from './prefs';

const source: PlannableSource = {
  async list(ctx) {
    const areas = pileAreas(await getPlannerSettings());
    const parts = await loadPileParts(ctx, areas);
    const items: PlannableItem[] = [];
    for (const area of areas) {
      if (!parts.some((p) => p.area === area)) continue;
      items.push({
        id: pileId(area),
        kind: 'pile',
        title: t.planner.pile.title[area],
        to: `/planner?item=${encodeURIComponent(pileKey(area))}`,
        durationMin: PILE_MINUTES[area],
        priority: 2,
      });
    }
    return items;
  },
};

export default source;
