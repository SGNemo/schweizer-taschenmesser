import { highlightParts } from '../searchIndex';
import styles from './mail.module.css';

/**
 * Search hits in a line of text: React text nodes with `<mark>` around the hits, never HTML (a subject or a
 * name is untrusted text). Without terms it is the plain text.
 */
export function Highlight({ text, terms }: { text: string; terms?: readonly string[] }) {
  if (!terms || terms.length === 0) return <>{text}</>;
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.hit ? (
          <mark key={i} className={styles.hit}>
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}
