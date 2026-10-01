import { useState } from 'react';
import { t } from '@/strings';
import { Button, Dialog, Icon, IconButton } from '@/ui';
import { copySecret } from '../copy';
import { recordGenerated, useGeneratedHistory } from '../history';
import styles from '../accounts.module.css';
import { GeneratorPanel } from './GeneratorPanel';

/**
 * Stand-alone generator ("Neues Passwort"): roll, copy only, or hand the value to the entry form so
 * password and account are saved together.
 */
export function GeneratorDialog({
  open,
  onClose,
  onSaveAs,
}: {
  open: boolean;
  onClose: () => void;
  onSaveAs: (password: string) => void;
}) {
  const g = t.accounts.generator;
  const [value, setValue] = useState('');
  const history = useGeneratedHistory((s) => s.items);

  return (
    <Dialog open={open} onClose={onClose} title={g.newPassword}>
      {open ? (
        <div className={styles.grid}>
          <GeneratorPanel onChange={setValue} />
          <div className={styles.inline}>
            <Button
              disabled={!value}
              onClick={() => {
                recordGenerated(value);
                void copySecret(t.accounts.fields.password, value);
              }}
            >
              {g.copyOnly}
            </Button>
            <Button
              variant="primary"
              disabled={!value}
              onClick={() => {
                recordGenerated(value);
                onSaveAs(value);
              }}
            >
              {g.saveAsAccount}
            </Button>
          </div>
          {history.length > 0 ? (
            <section aria-label={g.history} data-testid="generator-history">
              <h3>{g.history}</h3>
              <p className={styles.notice}>{g.historyHint}</p>
              <ul className={styles.historyList}>
                {history.map((item) => (
                  <li key={item} className={styles.inline}>
                    <code className={styles.generated}>{item}</code>
                    <IconButton
                      label={t.accounts.copyPassword}
                      onClick={() => void copySecret(t.accounts.fields.password, item)}
                    >
                      <Icon name="copy" size={18} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}
