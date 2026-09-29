import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Button, Checkbox, EmptyState, Icon, IconButton, TextField } from '@/ui';
import { entryRepo } from '../repo';
import { settings } from '../settings';

export default function MainPage() {
  const entries = useLiveQuery(() => entryRepo.active().sortBy('createdAt'), []);
  const [prefs] = useSettings('module.__ID__', settings.schema, settings.defaults);
  const [title, setTitle] = useState('');
  const [params, setParams] = useSearchParams();
  const form = useRef<HTMLFormElement>(null);

  // `?new=1` (from Quick-Add) focuses the create field.
  useEffect(() => {
    if (params.get('new')) {
      form.current?.querySelector('input')?.focus();
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    await entryRepo.create({ title: value, done: false });
    setTitle('');
  }

  const showDone = (prefs as { showDone?: boolean } | undefined)?.showDone ?? true;
  const visible = (entries ?? []).filter((e) => showDone || !e.done);

  return (
    <>
      <h1>__NAME__</h1>
      <form
        ref={form}
        onSubmit={add}
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          margin: 'var(--space-4) 0',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1 }}>
          <TextField
            label={t.actions.add}
            placeholder={t.example.addPlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary">
          {t.actions.add}
        </Button>
      </form>
      {entries && visible.length === 0 ? <EmptyState title={t.example.empty} /> : null}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map((e) => (
          <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1 }}>
              <Checkbox
                label={e.title}
                checked={e.done}
                onChange={(ev) => void entryRepo.update(e.id, { done: ev.target.checked })}
              />
            </div>
            <IconButton label={t.actions.delete} onClick={() => void entryRepo.remove(e.id)}>
              <Icon name="trash" />
            </IconButton>
          </li>
        ))}
      </ul>
    </>
  );
}
