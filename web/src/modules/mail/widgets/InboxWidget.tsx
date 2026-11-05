import { Link } from 'react-router';
import { t } from '@/strings';
import { NotizBody, WidgetBody } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { personName, subjectOf } from '../format';
import { INVOICE_DAYS, useMailSummary } from '../useSummary';
import styles from './InboxWidget.module.css';

/**
 * "Posteingang" (`notiz`, identity v3.1): the stamp with the unread count, two subject lines (sender name and subject
 * only, never mail text) and the invoice mails as a context line with one action. Reads the local cache only.
 */
export default function InboxWidget() {
  const s = useMailSummary();
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
            mark={<SignatureMark id="stamp" size={24} />}
            title={t.mail.widget.inboxTitle(s.unread)}
            lines={s.top.slice(0, 2).map((th) => `${personName(th.from)}: ${subjectOf(th.subject)}`)}
            meta={s.invoices > 0 ? undefined : t.mail.widget.inboxNoInvoices}
          />
          {s.invoices > 0 ? (
            <p className={styles.foot}>
              {t.mail.widget.inboxInvoices(s.invoices, INVOICE_DAYS)}
              {' · '}
              <Link to="/mail?q=rechnung">{t.mail.widget.inboxInvoicesAction}</Link>
            </p>
          ) : null}
        </>
      ) : null}
    </WidgetBody>
  );
}
