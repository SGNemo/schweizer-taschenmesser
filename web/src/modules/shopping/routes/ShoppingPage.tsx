import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, Checkbox, EmptyState, Icon, IconButton, PageHeader } from '@/ui';
import { isDuplicate, parseEntry, sortItems } from '../logic';
import { clearBought, itemRepo } from '../repo';

export default function ShoppingPage() {
  const items = useLiveQuery(async () => sortItems(await itemRepo.active().toArray()), []);
  const [text, setText] = useState('');
  const [params, setParams] = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  const toast = useUiStore((s) => s.toast);

  useEffect(() => {
    if (params.get('new')) {
      input.current?.focus();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  async function add() {
    const { name, quantity } = parseEntry(text);
    if (!name) return;
    if (!isDuplicate(items ?? [], name)) await itemRepo.create({ name, quantity, done: false });
    setText('');
    input.current?.focus();
  }

  const bought = (items ?? []).filter((i) => i.done).length;

  return (
    <>
      <PageHeader title={t.shopping.title} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}
      >
        <input
          ref={input}
          aria-label={t.shopping.addLabel}
          placeholder={t.shopping.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            flex: 1,
            minHeight: 'var(--touch)',
            padding: '0 var(--space-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'inherit',
          }}
        />
        <Button type="submit" variant="primary">
          {t.actions.add}
        </Button>
      </form>

      {items && items.length === 0 ? <EmptyState icon="cart" title={t.shopping.empty} /> : null}
      <Card as="div">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(items ?? []).map((i) => (
            <li key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{ flex: 1, opacity: i.done ? 0.55 : 1 }}>
                <Checkbox
                  label={
                    <span style={{ textDecoration: i.done ? 'line-through' : 'none' }}>
                      {i.quantity ? `${i.quantity} · ` : ''}
                      {i.name}
                    </span>
                  }
                  checked={i.done}
                  onChange={(e) => void itemRepo.update(i.id, { done: e.target.checked })}
                />
              </div>
              <IconButton
                label={`${t.actions.delete}: ${i.name}`}
                onClick={() => void itemRepo.remove(i.id)}
              >
                <Icon name="trash" />
              </IconButton>
            </li>
          ))}
        </ul>
      </Card>
      {bought > 0 ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button
            onClick={async () => {
              const n = await clearBought();
              toast(t.shopping.cleared(n));
            }}
          >
            {t.shopping.clearBought(bought)}
          </Button>
        </div>
      ) : null}
    </>
  );
}
