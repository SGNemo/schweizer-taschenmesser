import { useEffect, useState, type FormEvent } from 'react';
import { requireNotice } from '@/core/legal/notices';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import { t } from '@/strings';
import { Button, TextField } from '@/ui';
import {
  loadSubscriptions,
  normalizeIcsUrl,
  saveSubscriptions,
  type IcsSubscription,
} from './subscriptions';
import { syncIcs } from './sync';
import styles from './Settings.module.css';

const s = t.connectors.ics;

export default function IcsSettings({
  ctx,
  onChanged,
}: {
  ctx: ConnectorContext;
  onChanged: () => void;
}) {
  const [list, setList] = useState<IcsSubscription[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadSubscriptions(ctx).then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [ctx]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    const address = normalizeIcsUrl(url);
    if (!address) return setError(s.badUrl);
    setBusy(true);
    try {
      await requireNotice('connector-ics');
      const entry: IcsSubscription = {
        id: crypto.randomUUID().slice(0, 8),
        name: name.trim() || s.defaultName(list.length + 1),
        url: address,
      };
      // Try it once so a wrong address is reported now, not silently later.
      const probe = {
        ...ctx,
        secrets: { ...ctx.secrets, get: async () => JSON.stringify([entry]) },
      };
      await syncIcs(probe, { calendarId: entry.id, from: '1900-01-01', to: '2999-12-31' });
      const next = [...list, entry];
      await saveSubscriptions(ctx, next);
      setList(next);
      setName('');
      setUrl('');
      onChanged();
    } catch (err) {
      setError(
        err instanceof ConnectorError && err.code === 'no-proxy'
          ? s.noProxy
          : err instanceof ConnectorError && err.code === 'bad-response'
            ? s.notACalendar
            : s.unreachable,
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const next = list.filter((x) => x.id !== id);
    await saveSubscriptions(ctx, next);
    setList(next);
    onChanged();
  }

  return (
    <div className={styles.root}>
      {list.length > 0 ? (
        <ul className={styles.list} aria-label={s.listLabel}>
          {list.map((item) => (
            <li key={item.id} className={styles.row}>
              <span>{item.name}</span>
              <Button onClick={() => void remove(item.id)}>{s.remove(item.name)}</Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={(e) => void add(e)} className={styles.form}>
        <TextField label={s.name} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label={s.url}
          hint={s.urlHint}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
            {busy ? s.checking : s.add}
          </Button>
        </div>
      </form>
    </div>
  );
}
