import { useState } from 'react';
import { MAIL_LINK_TYPES, type MailLinkType } from '@/core/mail/prefill';
import { useModuleStates } from '@/core/modules/activation';
import { availableTypes } from '@/quickCapture/targets';
import { t } from '@/strings';
import { RowMenu } from '@/ui';
import styles from './mail.module.css';

/** The "Aus dieser Mail anlegen" menu: only destinations whose module is on. Two clicks from the mail. */
export function LinkMenu({ onPick }: { onPick: (type: MailLinkType) => void }) {
  const [open, setOpen] = useState(false);
  const states = useModuleStates();
  const available = availableTypes(states);
  const types = MAIL_LINK_TYPES.filter((type) => available.includes(type));

  if (!states) return null;
  if (types.length === 0) return <p className={styles.hint}>{t.mail.link.noModules}</p>;
  return (
    <RowMenu
      label={t.mail.link.menu}
      open={open}
      onOpenChange={setOpen}
      items={types.map((type) => ({
        id: type,
        label: t.quickCapture.type[type],
        onSelect: () => onPick(type),
      }))}
    />
  );
}
