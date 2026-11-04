import type { NoteBlock } from '@/core/changelog/notes';
import styles from './ReleaseNotes.module.css';

/** The change list of one version: eyebrow headings, one hairline row per change. Plain text only. */
export function ReleaseNotes({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <div className={styles.notes}>
      {blocks.map((b, i) => (
        <section key={i} className={styles.block}>
          {b.heading ? (
            <h4 className={[styles.heading, b.warning ? styles.warning : ''].join(' ')}>
              {b.heading}
            </h4>
          ) : null}
          <ul className={styles.list}>
            {b.items.map((item, j) => (
              <li key={j} className={styles.item}>
                {item.lead ? <strong className={styles.lead}>{item.lead}</strong> : null}
                {item.lead ? ' ' : null}
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
