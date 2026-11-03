import styles from './NotePaper.module.css';

/**
 * Signature of the notes: a sheet of ruled paper with a margin line and the first lines of the scratchpad
 * on it. Pure decoration (the text is also in the list), so it is hidden from assistive technology.
 * Ink and lines take the module hue; it never moves.
 */
export function NotePaper({ text }: { text?: string }) {
  return (
    <div className={styles.paper} aria-hidden="true" data-testid="note-paper">
      <span className={styles.text}>{text}</span>
    </div>
  );
}
