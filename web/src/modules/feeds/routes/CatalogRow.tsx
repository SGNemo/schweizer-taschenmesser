import { t } from '@/strings';
import { Button, Icon, ItemRow } from '@/ui';
import type { CatalogEntry } from '../catalog';
import { feedKey, hostOf } from '../logic';

/** One source of the starter catalogue: name, site (and region), and "Hinzufügen" – or "Abonniert" once it is in the list. */
export function CatalogRow({
  entry,
  subscribed,
  onAdd,
}: {
  entry: CatalogEntry;
  subscribed: ReadonlySet<string>;
  onAdd: (entry: CatalogEntry) => void;
}) {
  const s = t.feeds.catalog;
  const has = subscribed.has(feedKey(entry.url));
  return (
    <ItemRow
      title={entry.title}
      // The site only when the name does not already say it ("tagesschau.de").
      meta={[hostOf(entry.site) === entry.title ? '' : hostOf(entry.site), entry.region]
        .filter(Boolean)
        .join(' · ')}
      end={
        has ? (
          <span data-testid={`feeds-catalog-added-${entry.id}`}>
            <Icon name="check" size={16} /> {s.added}
          </span>
        ) : (
          <Button
            aria-label={s.addNamed(entry.title)}
            data-testid={`feeds-catalog-add-${entry.id}`}
            onClick={() => onAdd(entry)}
          >
            {s.add}
          </Button>
        )
      }
    />
  );
}
