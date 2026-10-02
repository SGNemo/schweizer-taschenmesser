import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  patternStyles,
  TextField,
} from '@/ui';
import { isDuplicate, parseEntry, sortItems } from '../logic';
import { clearBought, itemRepo } from '../repo';
import { StartDataButton } from '@/core/importer/StartDataButton';

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
        className={patternStyles.inlineForm}
      >
        <TextField
          ref={input}
          label={t.shopping.addLabel}
          labelHidden
          placeholder={t.shopping.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit">{t.actions.add}</Button>
      </form>

      {items && items.length === 0 ? (
        <EmptyState title={t.shopping.empty}>
          <StartDataButton moduleId="shopping" />
        </EmptyState>
      ) : null}
      <Card as="div">
        <ul className={patternStyles.plainList}>
          {(items ?? []).map((i) => (
            <li key={i.id} className={patternStyles.hstackCenter}>
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
        <div className={patternStyles.gapTop}>
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
