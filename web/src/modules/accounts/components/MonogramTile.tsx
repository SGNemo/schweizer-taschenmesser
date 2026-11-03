import styles from './MonogramTile.module.css';

/** Step 0..4 from the title, so the same entry always gets the same tile; the hue is always the module's. */
const step = (title: string): number => {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 5;
  return h;
};

/**
 * Tile with the first letter of the title instead of a favicon (a favicon would mean a request per site).
 * Decoration (`aria-hidden`): the title is the row's text.
 */
export function MonogramTile({ title }: { title: string }) {
  const letter = [...title.trim()][0]?.toLocaleUpperCase() ?? '?';
  return (
    <span className={styles.tile} data-step={step(title)} aria-hidden="true">
      {letter}
    </span>
  );
}
