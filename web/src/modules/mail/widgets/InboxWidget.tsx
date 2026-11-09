import { Link } from 'react-router';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { NotizBody, WidgetBody } from '@/ui';
import { personName, subjectOf } from '../format';
import { toCreate } from '../invoiceRow';
import { settings } from '../settings';
import { useInvoiceOffers } from '../useInvoiceOffers';
import { INVOICE_DAYS, useMailSummary } from '../useSummary';
import styles from './InboxWidget.module.css';

/**
 * "Posteingang" (`notiz`, identity v3.1): the stamp with the unread count, two subject lines (sender name and subject
 * only, never mail text) and, as a context line that is the way there, the invoices still to add from the list
 * („Kopf leer“ 3b). Reads the local cache only.
 */
const NO_THREADS: never[] = [];

export default function InboxWidget() {
  const s = useMailSummary();
  const [prefs] = useSettings('module.mail', settings.schema, settings.defaults);
  const offerInvoices = (prefs as { offerInvoices?: boolean } | undefined)?.offerInvoices ?? true;
  const open = toCreate(useInvoiceOffers(s?.recent ?? NO_THREADS, offerInvoices));
  const empty = s !== undefined && s.total === 0;
  return (
    <WidgetBody
      loading={!s}
      isEmpty={empty}
      empty={t.mail.widget.empty}
      emptyAction={{ label: t.mail.widget.emptyAction, to: '/mail' }}
    >
      {s && !empty ? (
        <>
          <NotizBody
            title={t.mail.widget.inboxTitle(s.unread)}
            lines={s.top
              .slice(0, 2)
              .map((th) => `${personName(th.from)}: ${subjectOf(th.subject)}`)}
            meta={s.invoices > 0 ? undefined : t.mail.widget.inboxNoInvoices(INVOICE_DAYS)}
          />
          {open > 0 ? (
            <p className={styles.foot}>
              <Link to="/mail">{t.mail.widget.inboxToCreate(open)}</Link>
            </p>
          ) : null}
        </>
      ) : null}
    </WidgetBody>
  );
}
