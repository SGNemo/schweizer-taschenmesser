import { useRef, useState } from 'react';
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
import { lookUp, type FeedPreview, type LookUpResult } from '../discover';
import { feedKey, hostOf, normalizeFeedUrl } from '../logic';
import { CatalogRow } from './CatalogRow';
import { FeedPreviewView } from './FeedPreviewView';
import styles from './feeds.module.css';

/** A typed address: something with a dot and no space that reads as an http(s) address. */
export function typedAddress(query: string): string | undefined {
  const q = query.trim();
  if (!q.includes('.') || /\s/.test(q)) return undefined;
  const url = normalizeFeedUrl(q);
  // "u.s." is a search word, not a host: an address ends in a top-level domain (or is an IPv4 address).
  const host = url ? new URL(url).hostname : '';
  return /\.([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    ? url
    : undefined;
}

/**
 * "Feed eintragen": one field for a search word or an address. A word filters the starter catalogue
 * (one tap adds a source, a tap on the name shows its newest articles); an address is looked up on
 * "Ansehen" (feed or website) and shown before subscribing, or goes straight on to the form.
 * The network is used only on those clicks.
 */
export function AddDialog({
  open,
  initialQuery = '',
  subscribed,
  onAdd,
  onSubscribe,
  onAddress,
  onClose,
}: {
  open: boolean;
  initialQuery?: string;
  /** `feedKey`s of the feeds already subscribed. */
  subscribed: ReadonlySet<string>;
  onAdd: (entry: CatalogEntry) => void;
  /** Subscribe to a previewed feed; `siteUrl` is the website it was found on. */
  onSubscribe: (feed: FeedPreview, siteUrl?: string) => void;
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
  // The lookup on screen: the address, where it came from, and what was found (`undefined` = running).
  const [look, setLook] = useState<{
    url: string;
    entry?: CatalogEntry;
    site?: string;
    result?: LookUpResult;
  } | null>(null);
  const run = useRef(0);

  function preview(url: string, from: { entry?: CatalogEntry; site?: string } = {}) {
    const id = ++run.current;
    setLook({ url, ...from });
    void lookUp(url).then((result) => {
      // A lookup the person left (back, another one) is dropped.
      if (run.current === id) setLook((l) => (l ? { ...l, result } : l));
    });
  }

  function back() {
    run.current++;
    setLook(null);
    // The search field comes back; keyboard and screen-reader users land there again.
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('input[data-feeds-find]')?.focus(),
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={s.add}
      size="roomy"
      footer={<Button onClick={onClose}>{s.done}</Button>}
    >
      {look ? (
        <FeedPreviewView
          address={look.url}
          result={look.result}
          subscribed={subscribed}
          onSubscribe={(feed) => {
            if (look.entry && feedKey(look.entry.url) === feedKey(feed.url)) onAdd(look.entry);
            else onSubscribe(feed, look.site ?? look.url);
          }}
          onPick={(url) => preview(url, { site: look.site ?? look.url })}
          onAnyway={() => onAddress(look.url)}
          onBack={back}
        />
      ) : (
        <div className={styles.form}>
          <TextField
            label={s.find.query}
            hint={s.find.queryHint}
            value={query}
            data-autofocus
            data-feeds-find=""
            type="search"
            inputMode="search"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && address) {
                e.preventDefault();
                preview(address);
              }
            }}
          />
          {address ? (
            <ItemList label={s.find.address}>
              <ItemRow
                title={hostOf(address)}
                meta={address}
                end={
                  <Button variant="primary" onClick={() => preview(address)}>
                    {s.find.preview}
                  </Button>
                }
              />
            </ItemList>
          ) : null}
          {address ? (
            <Button variant="ghost" onClick={() => onAddress(address)}>
              {s.find.addAddress}
            </Button>
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
          {hits.length > 0 ? <p className={styles.muted}>{s.preview.tapHint}</p> : null}
          {hits.length === 0 && !address ? (
            <p className={styles.muted} data-testid="feeds-catalog-none">
              {s.find.noMatch}
            </p>
          ) : null}
          {hits.length > 0 ? (
            <GroupedList
              listId="feeds-catalog"
              forceOpen={searching}
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
                        onPreview={(e) => preview(e.url, { entry: e })}
                      />
                    ))}
                  </ItemList>
                ),
              }))}
            />
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
