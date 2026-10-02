import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  Chips,
  EmptyState,
  Icon,
  IconButton,
  PageHeader,
  patternStyles,
  Progress,
  TextField,
} from '@/ui';
import { ListEditor, type ListTarget } from '../components/ListEditor';
import { nextOrder, progress, sortItems } from '../logic';
import { duplicateList, itemRepo, listRepo, resetList } from '../repo';

export default function PackingPage() {
  const lists = useLiveQuery(
    async () => (await listRepo.active().toArray()).sort((a, b) => a.createdAt - b.createdAt),
    [],
  );
  const allItems = useLiveQuery(() => itemRepo.active().toArray(), []);
  const [selected, setSelected] = useState<string | undefined>();
  const [target, setTarget] = useState<ListTarget>(null);
  const [text, setText] = useState('');
  const [params, setParams] = useSearchParams();
  const toast = useUiStore((s) => s.toast);

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const current = lists?.find((l) => l.id === selected) ?? lists?.[0];
  const items = sortItems((allItems ?? []).filter((i) => i.listId === current?.id));
  const p = progress(items);

  async function addItem() {
    const name = text.trim();
    if (!name || !current) return;
    await itemRepo.create({ listId: current.id, name, packed: false, order: nextOrder(items) });
    setText('');
  }

  return (
    <>
      <PageHeader title={t.packing.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.packing.addList}
        </Button>
      </PageHeader>

      {lists && lists.length === 0 ? (
        <EmptyState title={t.packing.empty}>
          <StartDataButton moduleId="packing" />
        </EmptyState>
      ) : null}
      {lists && lists.length > 0 ? (
        <div className={patternStyles.gapBottom}>
          <Chips label={t.packing.lists}>
            {lists.map((l) => (
              <Chip
                key={l.id}
                label={l.name}
                selected={l.id === current?.id}
                onClick={() => setSelected(l.id)}
              />
            ))}
          </Chips>
        </div>
      ) : null}

      {current ? (
        <Card as="section" title={current.name}>
          {current.note ? <p className={patternStyles.muted}>{current.note}</p> : null}
          <p aria-live="polite" data-testid="packing-progress">
            {t.packing.progress(p.packed, p.total)}
            {p.complete ? ` · ${t.packing.complete}` : ''}
          </p>
          <Progress value={p.packed} max={p.total} label={t.packing.progress(p.packed, p.total)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addItem();
            }}
            className={patternStyles.inlineForm}
          >
            <TextField
              label={t.packing.addItem}
              labelHidden
              placeholder={t.packing.itemPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit">{t.actions.add}</Button>
          </form>
          <ul className={patternStyles.plainList}>
            {items.map((i) => (
              <li key={i.id} className={patternStyles.hstackCenter}>
                <div style={{ flex: 1, opacity: i.packed ? 0.55 : 1 }}>
                  <Checkbox
                    label={i.name}
                    checked={i.packed}
                    onChange={(e) => void itemRepo.update(i.id, { packed: e.target.checked })}
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-4)',
            }}
          >
            <Button onClick={() => void resetList(current.id)} disabled={p.packed === 0}>
              {t.packing.reset}
            </Button>
            <Button
              onClick={async () => {
                const id = await duplicateList(current.id);
                setSelected(id);
                toast(t.packing.copied);
              }}
            >
              {t.packing.duplicate}
            </Button>
            <Button variant="ghost" onClick={() => setTarget(current)}>
              {t.actions.edit}
            </Button>
          </div>
        </Card>
      ) : null}

      <ListEditor
        target={openTarget}
        onClose={closeEditor}
        onCreated={setSelected}
        onDeleted={() => setSelected(undefined)}
      />
    </>
  );
}
