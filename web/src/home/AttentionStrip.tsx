import { useId, useState } from 'react';
import { Link } from 'react-router';
import { rankAttention, useAttentionItems } from '@/core/modules/contributions';
import { useLiveAttention } from '@/core/modules/liveAttention';
import type { AttentionCover, AttentionItem } from '@/core/modules/types';
import { useAmountMask } from '@/core/focus/maskAmounts';
import { useFocusSettings } from '@/core/settings/focus';
import { useUpdateStore } from '@/core/update/controller';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { moduleOfPath, splitFigure } from './attentionCard';
import { coveredIds, foldAttention, foldPhrases } from './attentionFold';
import styles from './AttentionStrip.module.css';

/** Core items that do not belong to a module. */
function useCoreItems(): AttentionItem[] {
  const update = useUpdateStore((s) => s.state);
  return update.phase === 'available'
    ? [
        {
          id: 'core:update',
          tone: 'accent',
          icon: 'download',
          title: t.attention.updateAvailable,
          detail: update.info.version,
          to: '/settings#updates',
          rank: 0,
          due: 'today',
        },
      ]
    : [];
}

/**
 * One entry of "Jetzt wichtig" as a small card on a tone step (no shadow, no frame). It has the module's icon on a plate in the module's hue, the
 * count as a big figure, the text and an optional context line; no edge stripe (identity v3). Colour never stands alone:
 * `danger` (overdue / exceeded only) reddens the figure, the words say the same.
 */
function Card({ item: i }: { item: AttentionItem }) {
  // "Werte ausblenden": amounts in a title or context line ("noch 1,02 €", a new price) become dots.
  const mask = useAmountMask();
  const { figure, label } = splitFigure(i.title);
  return (
    <Link
      to={i.to}
      className={styles.item}
      data-tone={i.tone}
      data-hue={moduleOfPath(i.to)?.identity.hue}
    >
      <span className={styles.plate} aria-hidden="true">
        <Icon name={i.icon} size={18} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          {figure ? (
            <>
              <b className={styles.figure}>{figure}</b>{' '}
            </>
          ) : null}
          <span className={styles.label}>{mask(label)}</span>
        </span>
        {i.detail ? <span className={styles.detail}>{mask(i.detail)}</span> : null}
      </span>
    </Link>
  );
}

interface Props {
  /** Blocks on the page that list single things themselves (`activeCovers`): their entries are left out. */
  covers?: readonly AttentionCover[];
  /**
   * The entries, when the page has read them already (same shared query): the strip then stands in the page's
   * first paint instead of one step later, which would push the cards below it.
   */
  items?: readonly AttentionItem[];
}

/**
 * The strip. Overdue / exceeded (`danger`) and due today (`due`) are cards, however many; everything else
 * waits in one line, "Kann warten · n", that opens the folded cards below the strip (`foldAttention`). With the focus setting
 * "ruhiges Jetzt wichtig" off every entry is a card.
 */
export function AttentionStrip({ covers, items: given }: Props = {}) {
  const own = useAttentionItems();
  const items = given ?? own;
  const core = useCoreItems();
  const live = useLiveAttention((s) => s.bySource);
  const [focus] = useFocusSettings();
  const [open, setOpen] = useState(false);
  const mask = useAmountMask();
  const listId = useId();
  const ranked = [...core, ...rankAttention([...(items ?? []), ...Object.values(live).flat()])];
  const covered = covers ? coveredIds(covers, ranked) : undefined;
  const all = covered ? ranked.filter((i) => !covered.has(i.id)) : ranked;
  if (all.length === 0) return null;

  const { visible, waiting } = foldAttention(all, focus.calmAttention);
  const { phrases, more } = foldPhrases(waiting);
  return (
    <section className={styles.strip} aria-label={t.attention.title} data-testid="attention">
      {visible.length > 0 ? <h2 className={styles.heading}>{t.attention.title}</h2> : null}
      <ul className={styles.list}>
        {visible.map((i) => (
          <li key={i.id}>
            <Card item={i} />
          </li>
        ))}
        {waiting.length > 0 ? (
          <li className={styles.foldCell}>
            <button
              type="button"
              className={styles.fold}
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((o) => !o)}
              data-testid="attention-waiting"
            >
              <span className={styles.chevron} aria-hidden="true">
                <Icon name="chevronRight" size={16} />
              </span>
              <span className={styles.foldText}>
                <span className={styles.foldTitle}>{t.attention.canWait(waiting.length)}</span>
                {' · '}
                {mask(phrases.join(', '))}
                {more ? ' …' : ''}
                {' · '}
                {t.attention.canWaitNote}
              </span>
            </button>
          </li>
        ) : null}
      </ul>
      {waiting.length > 0 ? (
        <ul
          className={styles.waitingList}
          id={listId}
          hidden={!open}
          data-testid="attention-waiting-list"
        >
          {waiting.map((i) => (
            <li key={i.id}>
              <Card item={i} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
