import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { db } from '@/core/db/db';
import { SEED_BANNER_KEY } from '@/core/seed/dev';
import { tDev } from '@/strings.dev';
import { Button, Icon } from '@/ui';
import styles from './SeedBanner.module.css';
import { settingsPath } from '@/core/settings/registry/paths';

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

/** Shown once after the Dev-Preview filled an empty app with test data: one line, dismissible. */
export default function SeedBanner() {
  const navigate = useNavigate();
  const visible = useLiveQuery(async () => (await meta().get(SEED_BANNER_KEY))?.value === true, []);
  if (!visible) return null;
  const dismiss = () => void meta().delete(SEED_BANNER_KEY);
  return (
    <section className={styles.banner} aria-label={tDev.banner.label} data-testid="seed-banner">
      <span className={styles.title} title={tDev.banner.text}>
        {tDev.banner.text}
      </span>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          onClick={() => {
            dismiss();
            void navigate(settingsPath('entwickler', 'developer'));
          }}
        >
          <Icon name="settings" size={18} />
          <span className={styles.openLabel}>{tDev.banner.open}</span>
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          {tDev.banner.dismiss}
        </Button>
      </div>
    </section>
  );
}
