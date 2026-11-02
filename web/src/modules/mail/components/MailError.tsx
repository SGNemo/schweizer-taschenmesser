import { Link } from 'react-router';
import type { MailErrorCode } from '@/core/mail/types';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import styles from './mail.module.css';

/** A calm, specific message for a failed call, with the way out (Settings → Verbindungen). */
export function MailError({ code }: { code: MailErrorCode }) {
  const text = t.mail.errors[code] ?? t.mail.errors.generic;
  return (
    <div className={styles.notice} role="alert">
      <span>{text}</span>
      {code === 'expired' || code === 'denied' ? (
        <Link to={settingsPath('verbindungen', 'connectors')}>{t.mail.errors.action}</Link>
      ) : null}
    </div>
  );
}
