import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { db } from '@/core/db/db';
import { SEED_BANNER_KEY } from '@/core/seed/dev';
import { tDev } from '@/strings.dev';
import { Button } from '@/ui';
import styles from './UpdateBanner.module.css';

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

/** Shown once after the Dev-Preview filled an empty app with test data. */
export default function SeedBanner() {
  const navigate = useNavigate();
  const visible = useLiveQuery(async () => (await meta().get(SEED_BANNER_KEY))?.value === true, []);
  if (!visible) return null;
  const dismiss = () => void meta().delete(SEED_BANNER_KEY);
  return (
    <section className={styles.banner} aria-label={tDev.banner.label} data-testid="seed-banner">
      <div className={styles.head}>
        <span className={styles.title}>{tDev.banner.text}</span>
        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => {
              dismiss();
              void navigate('/settings#developer');
            }}
          >
            {tDev.banner.open}
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            {tDev.banner.dismiss}
          </Button>
        </div>
      </div>
    </section>
  );
}
