import { useState } from 'react';
import { useLang } from '@/core/i18n/lang';
import { t } from '@/strings';
import { Button, Dialog, GroupedList, ItemList, ItemRow, Segmented, TextField } from '@/ui';
import {
  catalogLang,
  groupCatalog,
  searchCatalog,
  type CatalogEntry,
  type CatalogLang,
} from '../catalog';
import { hostOf, normalizeFeedUrl } from '../logic';
import { CatalogRow } from './CatalogRow';
import styles from './feeds.module.css';

/** A typed address: something with a dot and no space that reads as an http(s) address. */
export function typedAddress(query: string): string | undefined {
  const q = query.trim();
  if (!q.includes('.') || /\s/.test(q)) return undefined;
  return normalizeFeedUrl(q);
}

/**
 * "Feed hinzufügen": one field for a search word or an address. A word filters the starter catalogue
 * (one tap adds a source); an address is offered as itself and goes on to the form.
 */
export function AddDialog({
  open,
  initialQuery = '',
  subscribed,
  onAdd,
  onAddress,
  onClose,
}: {
  open: boolean;
  initialQuery?: string;
  /** `feedKey`s of the feeds already subscribed. */
  subscribed: ReadonlySet<string>;
  onAdd: (entry: CatalogEntry) => void;
  /** The typed address goes to the form (name and group). */
  onAddress: (url: string) => void;
  onClose: () => void;
}) {
  const s = t.feeds;
  const appLang = useLang();
  const [query, setQuery] = useState(initialQuery);
  const [lang, setLang] = useState<CatalogLang>(catalogLang(appLang));
  const label = (c: CatalogEntry['category']) => s.catalog.categories[c];
  const hits = searchCatalog(query, lang, label);
  const address = typedAddress(query);
  const searching = query.trim() !== '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={s.add}
      size="roomy"
      footer={<Button onClick={onClose}>{s.done}</Button>}
    >
      <div className={styles.form}>
        <TextField
          label={s.find.query}
          hint={s.find.queryHint}
          value={query}
          data-autofocus
          type="search"
          inputMode="search"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && address) {
              e.preventDefault();
              onAddress(address);
            }
          }}
        />
        {address ? (
          <ItemList label={s.find.address}>
            <ItemRow
              title={hostOf(address)}
              meta={address}
              end={
                <Button variant="primary" onClick={() => onAddress(address)}>
                  {s.find.addAddress}
                </Button>
              }
            />
          </ItemList>
        ) : null}
        {searching ? null : (
          <Segmented
            label={s.catalog.lang}
            value={lang}
            options={[
              { value: 'de', label: s.catalog.langDe },
              { value: 'en', label: s.catalog.langEn },
            ]}
            onChange={setLang}
          />
        )}
        {hits.length === 0 && !address ? (
          <p className={styles.muted} data-testid="feeds-catalog-none">
            {s.find.noMatch}
          </p>
        ) : null}
        {hits.length > 0 ? (
          <GroupedList
            listId="feeds-catalog"
            label={s.catalog.label}
            groups={groupCatalog(hits).map((g) => ({
              id: g.category,
              label: label(g.category),
              count: g.entries.length,
              children: (
                <ItemList>
                  {g.entries.map((entry) => (
                    <CatalogRow
                      key={entry.id}
                      entry={entry}
                      subscribed={subscribed}
                      onAdd={onAdd}
                    />
                  ))}
                </ItemList>
              ),
            }))}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
