import { dateTimeFormat } from '@/core/i18n/format';
import { t } from '@/strings';
import { Button, ItemList, ItemRow } from '@/ui';
import type { FeedPreview, LookUpResult } from '../discover';
import { feedKey, hostOf } from '../logic';
import styles from './feeds.module.css';

const WHEN: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * What a click on "Ansehen" found: the newest articles of a feed (with "Abonnieren"), the feeds a
 * website names (to pick one), or a calm sentence why there is nothing to show – with the way on.
 */
export function FeedPreviewView({
  address,
  result,
  subscribed,
  onSubscribe,
  onPick,
  onAnyway,
  onBack,
}: {
  /** The address that was looked up. */
  address: string;
  /** `undefined` while the lookup runs. */
  result: LookUpResult | undefined;
  subscribed: ReadonlySet<string>;
  onSubscribe: (feed: FeedPreview) => void;
  onPick: (url: string) => void;
  /** Enter the address without a preview (form). */
  onAnyway: () => void;
  onBack: () => void;
}) {
  const s = t.feeds.preview;
  const back = <Button onClick={onBack}>{s.back}</Button>;

  if (!result)
    return (
      <p role="status" className={styles.muted} data-testid="feeds-preview-checking">
        {s.checking(hostOf(address))}
      </p>
    );

  if (result.kind === 'feed') {
    const feed = result.feed;
    const has = subscribed.has(feedKey(feed.url));
    return (
      <section aria-labelledby="feeds-preview-title" data-testid="feeds-preview">
        <h3 id="feeds-preview-title" className={styles.previewTitle}>
          {feed.title || hostOf(feed.url)}
        </h3>
        <p className={styles.muted}>{hostOf(feed.url)}</p>
        {feed.items.length === 0 ? (
          <p className={styles.muted}>{s.noItems}</p>
        ) : (
          <ItemList label={s.latest}>
            {feed.items.map((item) => (
              <ItemRow
                key={item.guid}
                title={item.title}
                meta={dateTimeFormat(WHEN).format(item.publishedAt)}
                href={item.url}
              />
            ))}
          </ItemList>
        )}
        <div className={styles.previewActions}>
          {back}
          {has ? (
            <span className={styles.muted} data-testid="feeds-preview-has">
              {t.feeds.catalog.added}
            </span>
          ) : (
            <Button variant="primary" onClick={() => onSubscribe(feed)}>
              {s.subscribe}
            </Button>
          )}
        </div>
      </section>
    );
  }

  if (result.kind === 'choices')
    return (
      <section aria-label={s.choose(result.links.length)} data-testid="feeds-preview-choices">
        <p>{s.choose(result.links.length)}</p>
        <ItemList label={s.choose(result.links.length)}>
          {result.links.map((link) => (
            <ItemRow
              key={link.url}
              title={link.title || hostOf(link.url)}
              meta={link.url}
              end={<Button onClick={() => onPick(link.url)}>{t.feeds.find.preview}</Button>}
            />
          ))}
        </ItemList>
        <div className={styles.previewActions}>{back}</div>
      </section>
    );

  const text =
    result.kind === 'none' ? s.none : result.reason === 'no-proxy' ? s.noProxy : s.network;
  return (
    <section data-testid="feeds-preview-none">
      <p>{text}</p>
      <div className={styles.previewActions}>
        {back}
        <Button variant="primary" onClick={onAnyway}>
          {s.anyway}
        </Button>
      </div>
    </section>
  );
}
