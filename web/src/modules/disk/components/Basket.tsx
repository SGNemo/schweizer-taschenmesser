import { t } from '@/strings';
import { Button, Card, IconButton, Icon } from '@/ui';
import { formatBytes } from '../format';
import { useDiskStore } from '../store';
import styles from './Basket.module.css';

/** Entries collected for one shared, confirmed deletion. Nothing happens until "Alle löschen …". */
export function Basket({ onDeleteAll }: { onDeleteAll: (ids: number[]) => void }) {
  const basket = useDiskStore((s) => s.basket);
  const remove = useDiskStore((s) => s.removeFromBasket);
  const clear = useDiskStore((s) => s.clearBasket);
  if (basket.length === 0) return null;
  const total = basket.reduce((s, b) => s + b.bytes, 0);
  return (
    <Card title={t.disk.basket.title}>
      <div data-testid="basket">
        <ul className={styles.list}>
          {basket.map((b) => (
            <li key={b.id} className={styles.row}>
              <span className={styles.name}>{b.name}</span>
              <span className={styles.size}>{formatBytes(b.bytes)}</span>
              <IconButton label={t.disk.basket.remove(b.name)} onClick={() => remove(b.id)}>
                <Icon name="close" size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
        <p className={styles.total} data-testid="basket-total">
          {t.disk.basket.total(basket.length, formatBytes(total))}
        </p>
        <div className={styles.actions}>
          <Button onClick={clear}>{t.disk.basket.clear}</Button>
          <Button variant="danger" onClick={() => onDeleteAll(basket.map((b) => b.id))}>
            {t.disk.basket.deleteAll}
          </Button>
        </div>
      </div>
    </Card>
  );
}
