import type { Stored } from '@/core/db/types';
import { currencyOf, formatMoney } from '@/core/money';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { nextCharge } from '../logic';
import type { Subscription } from '../schema';
import styles from '../routes/subscriptions.module.css';
import { ServiceTile } from './ServiceTile';

/**
 * The module's signature in the head: the next three charges as tiles with the date and the
 * price as text. A tile never moves; without anything ahead it says so in one line.
 */
export function NextChargesHead({ subs }: { subs: Stored<Subscription>[] }) {
  const day = today();
  const next = subs
    .filter((s) => s.active)
    .flatMap((s) => {
      const date = nextCharge(s, day);
      return date ? [{ s, date }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.s.name.localeCompare(b.s.name))
    .slice(0, 3);
  const e = t.subscriptions.ext.head;
  return (
    <section className={styles.headTiles} aria-label={e.title} data-testid="next-charges-head">
      <h2 className={styles.headTitle}>{e.title}</h2>
      {next.length === 0 ? (
        <p className={styles.headNothing}>{e.nothing}</p>
      ) : (
        <ul className={styles.headList}>
          {next.map(({ s, date }) => (
            <li key={s.id}>
              <ServiceTile name={s.name} />
              <span>
                {e.on(s.name, formatDay(date, 'd. MMM'), formatMoney(s.amountMinor, currencyOf(s)))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
