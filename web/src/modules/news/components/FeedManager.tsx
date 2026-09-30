import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { safeHttpUrl } from '@/core/io/feed';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, Dialog, Icon, IconButton, SelectField, Switch, TextField } from '@/ui';
import { loadFeed, storeArticles } from '../fetch';
import { urlKey } from '../importer';
import { ago } from '../logic';
import { articleRepo, feedRepo, feedStateRepo } from '../repo';
import { CATEGORIES, type Category } from '../schema';
import styles from '../routes/news.module.css';

const s = t.news.feeds;

export function FeedManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={s.title}>
      {open ? <Manager onClose={onClose} /> : null}
    </Dialog>
  );
}

function Manager({ onClose }: { onClose: () => void }) {
  const feeds = useLiveQuery(() => feedRepo.active().toArray(), []);
  const states = useLiveQuery(() => feedStateRepo.active().toArray(), []);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<Category>('nachrichten');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    const address = safeHttpUrl(url);
    if (!address) return setError(s.badUrl);
    if ((feeds ?? []).some((f) => urlKey(f.url) === urlKey(address))) return setError(s.exists);
    setBusy(true);
    try {
      const loaded = await loadFeed(address);
      if (loaded.status !== 'ok') return setError(s.errors.format!);
      const feed = await feedRepo.create({
        url: address,
        title: loaded.feed.title || new URL(address).hostname,
        category,
        active: true,
      });
      await storeArticles(feed.id, loaded.feed);
      setUrl('');
    } catch (err) {
      setError(s.errors[err instanceof Error ? err.message : 'network'] ?? s.errors.network!);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await feedRepo.remove(id);
    const ids = (await articleRepo.table.where('feedId').equals(id).primaryKeys()) as string[];
    if (ids.length > 0) await articleRepo.purge(ids);
    if (await feedStateRepo.get(id)) await feedStateRepo.purge([id]);
  }

  const stateOf = (id: string) => states?.find((x) => x.id === id);

  return (
    <div className={styles.manager}>
      {feeds && feeds.length === 0 ? <p className={styles.muted}>{s.none}</p> : null}
      {feeds && feeds.length > 0 ? (
        <ul className={styles.feedList} aria-label={s.list}>
          {feeds.map((f) => {
            const state = stateOf(f.id);
            return (
              <li key={f.id} className={styles.feedRow}>
                <div className={styles.feedMain}>
                  <strong>{f.title}</strong>
                  <span className={styles.muted}>
                    {t.news.categories[f.category]} ·{' '}
                    {state?.lastOkAt ? s.lastOk(ago(state.lastOkAt, now())) : s.neverLoaded}
                  </span>
                  {state?.lastError ? (
                    <span className={styles.error} role="status">
                      {s.errors[state.lastError] ?? s.errors.network}
                    </span>
                  ) : null}
                </div>
                <Switch
                  label={s.active(f.title)}
                  checked={f.active}
                  onChange={(checked) => void feedRepo.update(f.id, { active: checked })}
                />
                <IconButton label={s.remove(f.title)} onClick={() => void remove(f.id)}>
                  <Icon name="trash" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form onSubmit={(e) => void add(e)} className={styles.addForm}>
        <TextField
          label={s.url}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          autoComplete="off"
          spellCheck={false}
        />
        <SelectField
          label={s.category}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.news.categories[c]}
            </option>
          ))}
        </SelectField>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.row}>
          <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
            {busy ? s.adding : s.add}
          </Button>
          <Button onClick={onClose}>{s.close}</Button>
        </div>
      </form>
    </div>
  );
}
