import { useEffect, useState } from 'react';
import { t } from '@/strings';
import { IconButton, Icon } from '@/ui';
import { copySecret } from '../copy';
import type { TotpConfig } from '../schema';
import { totpNow, type TotpCode as Code } from '../totp';
import styles from '../accounts.module.css';

/** Live one-time code with a countdown; recomputed every second from the injectable clock. */
export function TotpCode({ config }: { config: TotpConfig }) {
  const [code, setCode] = useState<Code | undefined>(() => safe(config));

  useEffect(() => {
    const tick = () => setCode(safe(config));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [config]);

  if (!code) return null;
  const grouped =
    code.code.length === 6 ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : code.code;
  return (
    <div className={styles.detailRow}>
      <span>
        <span className={styles.detailLabel}>{t.accounts.fields.totp}</span>
        <span className={[styles.detailValue, styles.code].join(' ')} data-testid="totp-code">
          {grouped}
        </span>{' '}
        <span className={styles.notice}>{t.accounts.codeExpires(code.secondsLeft)}</span>
      </span>
      <span className={styles.detailActions}>
        <IconButton
          label={t.accounts.copyCode}
          onClick={() => void copySecret(t.accounts.fields.totp, code.code)}
        >
          <Icon name="copy" size={18} />
        </IconButton>
      </span>
    </div>
  );
}

function safe(config: TotpConfig): Code | undefined {
  try {
    return totpNow(config);
  } catch {
    return undefined; // an invalid secret must not break the detail view
  }
}
