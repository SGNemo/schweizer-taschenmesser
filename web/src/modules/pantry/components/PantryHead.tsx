import { HeroFigure, HeroSlot, Shelf } from '@/ui/identity';
import { t } from '@/strings';
import { PLACES, type Place } from '../schema';
import styles from './PantryHead.module.css';

export type ShelfCounts = Record<
  Place,
  { items: number; expired: number; soon: number; low: number }
>;

/** Jumps to the section of a place (no animation: nothing moves for people who asked for less). */
function jumpTo(place: Place) {
  const el = document.getElementById(`pantry-place-${place}`);
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  el.querySelector('h2')?.setAttribute('tabindex', '-1');
  el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

/** The state of one place in words: the worst thing first, "all good" when nothing needs a look. */
function stateLine(c: ShelfCounts[Place]): { text: string; tone: 'warn' | 'ok' } {
  // Expired food is a warning, not red: red is kept for overdue money and exceeded budgets (FOCUS, C24).
  if (c.expired > 0) return { text: t.pantry.shelf.expired(c.expired), tone: 'warn' };
  if (c.soon > 0) return { text: t.pantry.shelf.soon(c.soon), tone: 'warn' };
  if (c.low > 0) return { text: t.pantry.shelf.low(c.low), tone: 'warn' };
  return { text: t.pantry.shelf.fine, tone: 'ok' };
}

/**
 * Head of the pantry (`regal`, identity v3.1): the count as the figure with one context line, the shelf from the
 * signature library in slot M, and one tile per place that holds something (count + state in words) beside it as
 * controls: each jumps to the section of that place. Colour is never alone, every tile says its state.
 */
export function PantryHead({
  counts,
  beforeJump,
}: {
  counts: ShelfCounts;
  /** Called before the jump: the page shows every item again, so the section of the place exists. */
  beforeJump?: () => void;
}) {
  const places = PLACES.filter((p) => counts[p].items > 0);
  if (places.length === 0) return null;
  const total = places.reduce((n, p) => n + counts[p].items, 0);
  const sum = (k: 'expired' | 'soon' | 'low') => places.reduce((n, p) => n + counts[p][k], 0);
  const detail =
    t.pantry.shelf.summary(sum('expired'), sum('soon'), sum('low')) || t.pantry.shelf.summaryFine;
  return (
    <>
      <HeroSlot area="figure">
        <HeroFigure
          label={t.pantry.shelf.figureLabel}
          value={String(total)}
          unit={t.pantry.shelf.figureUnit}
          detail={detail}
          testId="pantry-total"
        />
      </HeroSlot>
      <HeroSlot area="signature">
        <Shelf size="M" />
      </HeroSlot>
      <HeroSlot area="extra">
        <div className={styles.shelf} data-testid="pantry-places">
          {places.map((p) => {
            const state = stateLine(counts[p]);
            return (
              <button
                key={p}
                type="button"
                className={styles.tile}
                aria-label={`${t.pantry.shelf.jump(t.pantry.places[p], counts[p].items)}${state.tone === 'ok' ? '' : ` · ${state.text}`}`}
                onClick={() => {
                  beforeJump?.();
                  requestAnimationFrame(() => jumpTo(p));
                }}
              >
                <span className={styles.name} aria-hidden="true">
                  {t.pantry.places[p]}
                </span>
                <span className={styles.num} aria-hidden="true">
                  {counts[p].items}
                </span>
                {state.tone === 'ok' ? null : (
                  <span className={styles.state} data-tone={state.tone} aria-hidden="true">
                    {state.text}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </HeroSlot>
    </>
  );
}
