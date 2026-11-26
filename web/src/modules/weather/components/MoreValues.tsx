import { useId, useState } from 'react';
import { tWeatherPage } from '@/strings.weatherPage';
import { Icon } from '@/ui';
import styles from '../routes/weather.module.css';
import type { MoreGroup } from '../moreValues';

/**
 * "Mehr Werte" (CONCEPT-INFO §2): closed by default; a button with `aria-expanded` and a region under it (not
 * `<details>`: the app's other disclosures and the stimulus counter use buttons). Groups as short definition lists.
 */
export function MoreValues({ groups }: { groups: readonly MoreGroup[] }) {
  const tp = tWeatherPage.use();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (groups.length === 0) return null;
  return (
    <section className={styles.more} data-testid="weather-more">
      <h2 className={styles.moreHead}>
        <button
          type="button"
          className={styles.moreToggle}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {tp.more}
          <span className={styles.moreChevron} aria-hidden="true">
            <Icon name="chevronDown" size={18} />
          </span>
        </button>
      </h2>
      <div id={id} role="region" aria-label={tp.more} hidden={!open} className={styles.moreGroups}>
        {groups.map((g) => (
          <div key={g.id} className={styles.moreGroup} data-group={g.id}>
            <h3>{g.title}</h3>
            {'text' in g ? (
              <p>{g.text}</p>
            ) : (
              <dl>
                {g.items.map((it) => (
                  <div
                    key={it.label}
                    className={styles.moreRow}
                    data-sub={it.sub ? 'true' : undefined}
                  >
                    <dt>{it.label}</dt>
                    <dd>{it.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
