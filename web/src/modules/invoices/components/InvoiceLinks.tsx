import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { plannedDay, removeLink, useLinks, type ResolvedLink } from '@/core/entitylinks';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from '../routes/invoices.module.css';

export interface LinkFact {
  label: string;
  value: ReactNode;
}

/**
 * Where an invoice came from and where it stands (planner hub S1, CONCEPT-LINKS §2 step 4): „Aus Mail“,
 * „Mahnung aus Mail vom 3. Nov.“ and „Im Plan“ as fact rows. Read through the link table and each target's own
 * module (`useLinks`): a thread in this device's mail cache opens in the app with one tap, a thread that is not
 * here (another desktop, the phone) offers the provider's web mail, and a target that cannot exist says so and
 * can be removed. The label is the subject of the time, rendered as text. Nothing is shown while loading, and
 * nothing at all for an invoice without links: the panel stays as it was.
 *
 * `onLeave` runs before a link navigates (the dialog closes itself).
 */
export function useInvoiceLinkFacts(invoiceId: string, onLeave?: () => void): LinkFact[] {
  const links = useLinks({ module: 'invoices', id: invoiceId });
  // Only while the planner is on (`plannedDay` answers nothing otherwise). Dexie reads only. A native `async`
  // function: a plain wrapper loses Dexie's read tracking after the first `await`, so a day the planner gives
  // the invoice while the page is open (a noted reminder takes it out of „Frist vorbei“) would never show.
  const planned = useLiveQuery(
    async () => plannedDay({ module: 'invoices', id: invoiceId }),
    [invoiceId],
  );
  const l = t.invoices.links;

  const byLabel = new Map<string, ReactNode[]>();
  for (const link of links ?? []) {
    // Only what the invoice itself carries; a ToDo that points here is the ToDo's link.
    if (link.direction !== 'out') continue;
    const { rel, on } = link.link;
    const label =
      rel === 'origin'
        ? l.origin
        : rel === 'dunning'
          ? l.dunning(on ? formatDay(on, 'd. MMM') : undefined)
          : l.about;
    byLabel.set(label, [
      ...(byLabel.get(label) ?? []),
      <LinkValue key={link.id} link={link} onLeave={onLeave} />,
    ]);
  }
  const facts: LinkFact[] = [...byLabel].map(([label, values]) => ({
    label,
    value: values.length === 1 ? values[0] : <div className={styles.linkValues}>{values}</div>,
  }));
  if (planned) {
    const day = formatDay(planned, 'EEE, d. MMM');
    facts.push({
      label: l.plan,
      value: (
        <Link
          to={`/planner?day=${planned}`}
          aria-label={l.planDay(day)}
          onClick={onLeave}
          data-testid="invoice-planned"
        >
          {day}
        </Link>
      ),
    });
  }
  return facts;
}

function LinkValue({ link, onLeave }: { link: ResolvedLink; onLeave?: () => void }) {
  const l = t.invoices.links;
  const { state } = link;
  // An alive target shows its title of today; everywhere else the label of the time stands in.
  const name = (state.state === 'alive' && state.title) || link.link.label;
  if (state.state === 'alive')
    return (
      <Link
        to={state.to}
        aria-label={l.openMail(name)}
        onClick={onLeave}
        data-testid="invoice-link"
      >
        {name}
      </Link>
    );
  // Only a mail thread has a web address (not in this device's cache, or the mail module is not here).
  const url = 'url' in state ? state.url : undefined;
  return (
    <span className={styles.linkValue} data-testid="invoice-link">
      <span>
        {name}
        {state.state === 'gone' ? ` · ${l.gone}` : url ? ` · ${l.elsewhere}` : null}
      </span>
      {url ? (
        // Opened only on this tap; the address names no account.
        <Button variant="ghost" size="sm" onClick={() => void getPlatform().app.openUrl(url)}>
          {l.inBrowser}
        </Button>
      ) : null}
      {state.state === 'gone' ? (
        <Button
          size="sm"
          aria-label={l.removeFor(name)}
          onClick={() => void undoableWithToast(l.removed, l.removed, () => removeLink(link.id))}
        >
          {l.remove}
        </Button>
      ) : null}
    </span>
  );
}

/** The same facts as a small list, for the invoice's dialog (the phone and narrow pages have no detail panel). */
export function InvoiceLinks({ invoiceId, onLeave }: { invoiceId: string; onLeave?: () => void }) {
  const facts = useInvoiceLinkFacts(invoiceId, onLeave);
  if (facts.length === 0) return null;
  return (
    <dl className={styles.linkFacts} data-testid="invoice-links">
      {facts.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
