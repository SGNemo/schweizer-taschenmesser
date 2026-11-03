import { useEffect, useState } from 'react';
import { tSettings2 } from '@/strings.settings2';
import styles from './SettingsLayout.module.css';

export interface TocEntry {
  id: string;
  title: string;
}

/**
 * Table of contents of a category page (wide windows): the sections as anchors, the one in view
 * marked. A plain jump, no animation; `scrollIntoView` follows the reduced-motion setting by default.
 */
export function SettingsToc({ entries }: { entries: readonly TocEntry[] }) {
  const n = tSettings2.use().nav;
  const [active, setActive] = useState<string>();
  const key = entries.map((e) => e.id).join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (list) => {
        for (const e of list)
          seen.set(e.target.getAttribute('aria-labelledby') ?? '', e.isIntersecting);
        const first = entries.find((x) => seen.get(x.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const e of entries) {
      const el = document.querySelector(`section[aria-labelledby="${CSS.escape(e.id)}"]`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // `key` stands for `entries`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (entries.length < 3) return null;
  return (
    <nav aria-label={n.toc} className={styles.toc} data-testid="settings-toc">
      <p className={styles.tocTitle}>{n.toc}</p>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              aria-current={(active ?? entries[0]?.id) === e.id ? 'location' : undefined}
              onClick={(ev) => {
                ev.preventDefault();
                const el = document.getElementById(e.id);
                // A section inside the closed Erweitert fold opens it first.
                el?.closest('details')?.setAttribute('open', '');
                el?.scrollIntoView({ block: 'start' });
                setActive(e.id);
              }}
            >
              {e.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
