import styles from './Pinboard.module.css';

/**
 * Signature of the saved items: three little cards pinned to a board, with the titles of the latest
 * entries. Decoration only (the same titles are in the list), hidden from assistive technology; the pins
 * take the module hue, nothing moves.
 */
export function Pinboard({ titles }: { titles: string[] }) {
  const cards = titles.slice(0, 3);
  return (
    <div className={styles.board} aria-hidden="true" data-testid="pinboard">
      {cards.length === 0 ? <span className={`${styles.card} ${styles.ghost}`} /> : null}
      {cards.map((title, i) => (
        <span key={`${i}-${title}`} className={styles.card} data-i={i}>
          {title}
        </span>
      ))}
    </div>
  );
}
